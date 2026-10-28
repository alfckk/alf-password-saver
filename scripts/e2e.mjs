// End-to-end check: loads dist-e2e as an unpacked extension in Playwright Chromium
// and walks through setup, save, autofill, update, lock, import and export.
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

const ROOT = resolve('test-pages');
const EXT = resolve('dist-e2e');
const OUT = resolve('test-results');
const PORT = 5599;
const BASE = `http://localhost:${PORT}`;
const MASTER = 'Correct-Horse-Battery-9';

mkdirSync(OUT, { recursive: true });

const server = createServer((req, res) => {
  const path = new URL(req.url, BASE).pathname;
  try {
    const body = readFileSync(join(ROOT, path === '/' ? 'index.html' : path));
    const type = { '.html': 'text/html', '.css': 'text/css' }[extname(path)] ?? 'application/octet-stream';
    res.writeHead(200, { 'content-type': `${type}; charset=utf-8` }).end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(PORT);

const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'ps-e2e-')), {
  channel: 'chromium',
  headless: true,
  acceptDownloads: true,
  viewport: { width: 1100, height: 720 },
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});

let failures = 0;
async function step(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures++;
    console.log(`  ✗ ${name}\n      ${String(err.message ?? err).split('\n')[0]}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const ui = (page) => page.locator('password-saver-root');

try {
  const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const extId = new URL(sw.url()).host;
  const extUrl = (p) => `chrome-extension://${extId}/${p}`;
  const page = await context.newPage();
  for (const p of context.pages()) if (p !== page) await p.close();

  async function popupItems() {
    const popup = await context.newPage();
    await popup.goto(extUrl('src/popup/index.html'));
    await popup.waitForSelector('input[placeholder="搜尋密碼"]');
    const text = await popup.locator('ul').allInnerTexts();
    return { popup, text: text.join('\n') };
  }

  await step('初始設定精靈建立保險庫', async () => {
    await page.goto(extUrl('src/options/index.html'));
    await page.fill('#mp', MASTER);
    await page.fill('#mp2', MASTER);
    await page.check('input[type=checkbox]');
    await page.click('button:has-text("建立保險庫")');
    await page.waitForSelector('text=Password Saver 設定', { timeout: 20000 });
  });

  await step('一般表單：送出後跳轉並顯示儲存提示', async () => {
    await page.goto(`${BASE}/basic.html`);
    await page.fill('#email', 'alice@example.com');
    await page.fill('#password', 'S3cret!pass');
    await page.click('button[type=submit]');
    await page.waitForURL('**/success.html');
    await ui(page).locator('text=要儲存密碼嗎？').waitFor({ timeout: 5000 });
    assert((await ui(page).locator('#ps-username').inputValue()) === 'alice@example.com', '使用者名稱不符');
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(OUT, 'save-prompt.png') });
    await ui(page).locator('.prompt .btn-primary').click();
    await ui(page).locator('.prompt').waitFor({ state: 'detached' });
  });

  await step('Popup 顯示已儲存的項目', async () => {
    const { popup, text } = await popupItems();
    assert(text.includes('alice@example.com'), `清單內容：${text}`);
    await popup.close();
  });

  await step('聚焦欄位自動展開下拉選單並填入', async () => {
    await page.goto(`${BASE}/basic.html`);
    await page.click('#email');
    await ui(page).locator('.dropdown .item').first().waitFor({ timeout: 5000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(OUT, 'fill-dropdown.png') });
    await ui(page).locator('.dropdown .item:has-text("alice@example.com")').click();
    await page.waitForFunction(() => document.querySelector('#password').value !== '');
    assert((await page.inputValue('#email')) === 'alice@example.com', 'email 未填入');
    assert((await page.inputValue('#password')) === 'S3cret!pass', '密碼未填入');
  });

  await step('以已儲存密碼送出不會重複提示', async () => {
    await page.click('button[type=submit]');
    await page.waitForURL('**/success.html');
    await page.waitForTimeout(800);
    assert((await ui(page).locator('.prompt').count()) === 0, '不應出現提示');
  });

  await step('SPA：延遲渲染、無 form、不跳轉', async () => {
    await page.goto(`${BASE}/spa.html`);
    await page.waitForSelector('#pass');
    await page.fill('#user', 'spa-user');
    await page.fill('#pass', 'Spa!Pass123');
    await page.click('#go');
    await ui(page).locator('text=要儲存密碼嗎？').waitFor({ timeout: 5000 });
    assert((await ui(page).locator('#ps-username').inputValue()) === 'spa-user', '使用者名稱不符');
    await ui(page).locator('.prompt .btn-primary').click();
  });

  await step('多步驟登入：合併第一步的帳號', async () => {
    await page.goto(`${BASE}/multistep-1.html`);
    await page.fill('#identifier', 'bob@example.com');
    await page.click('button[type=submit]');
    await page.waitForURL('**/multistep-2.html');
    await page.fill('#pw', 'B0b!secret');
    await page.click('button[type=submit]');
    await page.waitForURL('**/success.html');
    await ui(page).locator('text=要儲存密碼嗎？').waitFor({ timeout: 5000 });
    assert((await ui(page).locator('#ps-username').inputValue()) === 'bob@example.com', '未帶入第一步的帳號');
    await ui(page).locator('.prompt .btn-primary').click();
  });

  await step('變更密碼表單：提示更新並採用新密碼', async () => {
    await page.goto(`${BASE}/change-password.html`);
    await page.fill('#u', 'alice@example.com');
    await page.fill('#cur', 'S3cret!pass');
    await page.fill('#new', 'N3w!Pass456');
    await page.fill('#confirm', 'N3w!Pass456');
    await page.click('button[type=submit]');
    await page.waitForURL('**/success.html');
    await ui(page).locator('text=要更新密碼嗎？').waitFor({ timeout: 5000 });
    await ui(page).locator('.prompt .btn-primary').click();
  });

  await step('同源 iframe 內也能填入（使用更新後的密碼）', async () => {
    await page.goto(`${BASE}/iframe.html`);
    const frame = page.frameLocator('iframe');
    await frame.locator('#email').click();
    await frame.locator('password-saver-root .dropdown .item:has-text("alice@example.com")').click();
    await frame.locator('#password').evaluate((el) =>
      new Promise((done) => {
        const check = () => (el.value ? done() : setTimeout(check, 50));
        check();
      }),
    );
    assert((await frame.locator('#password').inputValue()) === 'N3w!Pass456', '密碼不是更新後的值');
  });

  await step('自動預填：選定的網站載入時填入最近使用的帳號', async () => {
    await page.goto(extUrl('src/options/index.html'));
    const section = page.locator('section:has-text("自動預填的網站")');
    await section.locator('input').fill('http://localhost:5599/');
    await section.locator('button:has-text("新增")').click();
    await section.locator('text=localhost').waitFor();
    await page.goto(`${BASE}/basic.html`);
    await page.waitForFunction(() => document.querySelector('#password').value !== '', null, { timeout: 5000 });
    assert((await page.inputValue('#email')) === 'alice@example.com', 'email 未預填');
    assert((await page.inputValue('#password')) === 'N3w!Pass456', '密碼未預填最近使用的帳號');
  });

  await step('自動預填：未選定的網站不會預填', async () => {
    await page.goto(extUrl('src/options/index.html'));
    const section = page.locator('section:has-text("自動預填的網站")');
    await section.locator('button[title="移除"]').click();
    await section.locator('text=目前沒有任何網站。').waitFor();
    await page.goto(`${BASE}/basic.html`);
    await page.waitForTimeout(1000);
    assert((await page.inputValue('#password')) === '', '不應預填');
  });

  const autoFillDomains = () =>
    sw.evaluate(async () => (await chrome.storage.local.get('settings')).settings?.autoFillDomains ?? []);

  await step('儲存提示：勾選後開啟此網站的自動預填', async () => {
    await page.goto(`${BASE}/spa.html`);
    await page.waitForSelector('#pass');
    await page.fill('#user', 'dave');
    await page.fill('#pass', 'Dave!pw123');
    await page.click('#go');
    const box = ui(page).locator('.prompt .check input');
    await box.waitFor({ timeout: 5000 });
    assert(!(await box.isChecked()), '預設不應勾選');
    await box.check();
    await page.screenshot({ path: join(OUT, 'save-prompt-autofill.png') });
    await ui(page).locator('.prompt .btn-primary').click();
    await ui(page).locator('.prompt').waitFor({ state: 'detached' });
    const domains = await autoFillDomains();
    assert(domains.includes('localhost'), `自動預填清單：${domains}`);
    await sw.evaluate(async () => {
      const { settings } = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...settings, autoFillDomains: [] } });
    });
  });

  await step('Popup 新增密碼時可選擇開啟自動預填', async () => {
    const popup = await context.newPage();
    await popup.goto(extUrl('src/popup/index.html'));
    await popup.click('button[title="新增密碼"]');
    await popup.fill('#f-origin', 'https://example.org/login');
    await popup.fill('#f-username', 'erin');
    await popup.fill('#f-password', 'Erin!pw456');
    await popup.check('label:has-text("在此網站開啟自動預填") input');
    await popup.screenshot({ path: join(OUT, 'popup-add-autofill.png') });
    await popup.click('button:has-text("儲存")');
    await popup.waitForSelector('text=使用者名稱');
    await popup.close();
    const domains = await autoFillDomains();
    assert(domains.includes('example.org'), `自動預填清單：${domains}`);
  });

  await step('已有的記錄：詳細資料頁可切換自動預填', async () => {
    const popup = await context.newPage();
    await popup.goto(extUrl('src/popup/index.html'));
    await popup.fill('input[placeholder="搜尋密碼"]', 'bob');
    await popup.locator('ul li').first().locator('button').first().click();
    const box = popup.locator('label:has-text("在此網站自動預填") input');
    await box.waitFor();
    assert(!(await box.isChecked()), '預設不應勾選');
    await box.check();
    await popup.waitForSelector('text=已開啟此網站的自動預填');
    await popup.screenshot({ path: join(OUT, 'popup-detail-autofill.png') });
    assert((await autoFillDomains()).includes('localhost'), '應開啟 localhost 的自動預填');
    await box.uncheck();
    await popup.waitForSelector('text=已關閉此網站的自動預填');
    assert(!(await autoFillDomains()).includes('localhost'), '應關閉 localhost 的自動預填');
    await popup.close();
  });

  await step('已有的記錄：編輯表單可關閉自動預填', async () => {
    const popup = await context.newPage();
    await popup.goto(extUrl('src/popup/index.html'));
    await popup.fill('input[placeholder="搜尋密碼"]', 'erin');
    await popup.locator('ul li').first().locator('button').first().click();
    await popup.click('button[title="編輯"]');
    const box = popup.locator('label:has-text("在此網站開啟自動預填") input');
    assert(await box.isChecked(), '應反映目前已開啟的狀態');
    await box.uncheck();
    await popup.click('button:has-text("儲存")');
    await popup.waitForSelector('text=已儲存');
    await popup.close();
    assert(!(await autoFillDomains()).includes('example.org'), '應關閉 example.org 的自動預填');
  });

  await step('自動鎖定可設為「永不」並清除計時器', async () => {
    await page.goto(extUrl('src/options/index.html'));
    const select = page.locator('section:has-text("安全性") select');
    await select.selectOption('0');
    await page.waitForSelector('text=保險庫會一直保持解鎖');
    await page.waitForTimeout(300);
    assert((await sw.evaluate(() => chrome.alarms.get('autolock'))) == null, '不應有自動鎖定計時器');
    await select.selectOption('15');
    await page.waitForTimeout(300);
    assert((await sw.evaluate(() => chrome.alarms.get('autolock'))) != null, '應恢復自動鎖定計時器');
  });

  await step('設定頁顯示作者與版本', async () => {
    const about = page.locator('section:has-text("關於")');
    await about.locator('text=Alvin CHIN').waitFor();
    await about.locator('text=0.1.1').waitFor();
  });

  await step('Popup 搜尋與詳細資料頁', async () => {
    const { popup } = await popupItems();
    await popup.screenshot({ path: join(OUT, 'popup-list.png') });
    await popup.fill('input[placeholder="搜尋密碼"]', 'bob');
    const rows = popup.locator('ul li');
    assert((await rows.count()) === 1, `搜尋結果數量 ${await rows.count()}`);
    await rows.first().locator('button').first().click();
    await popup.waitForSelector('text=使用者名稱');
    await popup.click('button[title="顯示"]');
    await popup.waitForSelector('text=B0b!secret');
    await popup.screenshot({ path: join(OUT, 'popup-detail.png') });
    await popup.close();
  });

  await step('鎖定後欄位下拉顯示「已鎖定」且不洩漏帳號', async () => {
    const { popup } = await popupItems();
    await popup.click('button[title="鎖定"]');
    await popup.waitForSelector('text=保險庫已鎖定');
    await popup.screenshot({ path: join(OUT, 'popup-locked.png') });
    await popup.close();
    await page.goto(`${BASE}/basic.html`);
    await page.click('#email');
    await ui(page).locator('.field-icon.locked').click();
    await ui(page).locator('text=保險庫已鎖定，解鎖後即可填入').waitFor({ timeout: 3000 });
    assert((await ui(page).locator('.dropdown .item').count()) === 0, '鎖定時不應列出帳號');
  });

  await step('鎖定時捕捉登入 → 解鎖後提示轉為可儲存', async () => {
    await page.fill('#email', 'carol@example.com');
    await page.fill('#password', 'Car0l!pw');
    await page.click('button[type=submit]');
    await page.waitForURL('**/success.html');
    await ui(page).locator('button:has-text("解鎖並儲存")').waitFor({ timeout: 5000 });
    const popup = await context.newPage();
    await popup.goto(extUrl('src/popup/index.html'));
    await popup.fill('input[placeholder="輸入主密碼"]', MASTER);
    await popup.click('button:has-text("解鎖")');
    await popup.waitForSelector('input[placeholder="搜尋密碼"]', { timeout: 20000 });
    await popup.close();
    await ui(page).locator('text=要儲存密碼嗎？').waitFor({ timeout: 5000 });
    await ui(page).locator('.prompt .btn-primary').click();
  });

  await step('錯誤主密碼無法解鎖', async () => {
    const popup = await context.newPage();
    await popup.goto(extUrl('src/popup/index.html'));
    await popup.click('button[title="鎖定"]');
    await popup.fill('input[placeholder="輸入主密碼"]', 'wrong-password');
    await popup.click('button:has-text("解鎖")');
    await popup.waitForSelector('text=主密碼錯誤', { timeout: 20000 });
    await popup.fill('input[placeholder="輸入主密碼"]', MASTER);
    await popup.click('button:has-text("解鎖")');
    await popup.waitForSelector('input[placeholder="搜尋密碼"]', { timeout: 20000 });
    await popup.close();
  });

  await step('「永不在此網站儲存」會寫入設定', async () => {
    await page.goto(`${BASE}/spa.html`);
    await page.waitForSelector('#pass');
    await page.fill('#user', 'someone');
    await page.fill('#pass', 'Other!pw1');
    await page.click('#go');
    await ui(page).locator('button:has-text("永不在此網站儲存")').click();
    await page.goto(extUrl('src/options/index.html'));
    await page.waitForSelector('section:has-text("永不儲存的網站") >> text=localhost');
  });

  await step('CSV 匯入（新增與更新）', async () => {
    const csv = join(OUT, 'import.csv');
    writeFileSync(
      csv,
      'name,url,username,password,note\nGitHub,https://github.com/login,dev,"gh,""pw""",work\nExample,http://localhost:5599/,bob@example.com,B0b!changed,\n',
    );
    await page.goto(extUrl('src/options/index.html'));
    await page.setInputFiles('input[type=file]', csv);
    await page.waitForSelector('text=已新增 1 筆、更新 1 筆、略過 0 筆。');
    await page.screenshot({ path: join(OUT, 'options.png'), fullPage: true });
  });

  await step('CSV 匯出需主密碼且內容正確', async () => {
    await page.fill('#export-pw', 'bad');
    await page.click('button:has-text("匯出 CSV")');
    await page.waitForSelector('text=主密碼錯誤', { timeout: 20000 });
    await page.fill('#export-pw', MASTER);
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      page.click('button:has-text("匯出 CSV")'),
    ]);
    const text = readFileSync(await download.path(), 'utf8');
    for (const expected of ['name,url,username,password,note', 'N3w!Pass456', 'B0b!changed', '"gh,""pw"""', 'carol@example.com']) {
      assert(text.includes(expected), `匯出內容缺少 ${expected}`);
    }
  });

  await step('儲存的資料是加密的（storage.local 無明文）', async () => {
    const raw = await sw.evaluate(async () => JSON.stringify(await chrome.storage.local.get(null)));
    for (const secret of ['N3w!Pass456', 'B0b!changed', 'alice@example.com']) {
      assert(!raw.includes(secret), `storage.local 含有明文 ${secret}`);
    }
  });
} finally {
  await context.close();
  server.close();
}

console.log(failures === 0 ? '\nAll e2e checks passed.' : `\n${failures} e2e check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
