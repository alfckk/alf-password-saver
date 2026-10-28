const AUTHOR = {
  name: 'Alvin CHIN',
  email: 'alvinc@alvincs.com',
  repo: 'https://github.com/alfckk/alf-password-saver',
};

export function About() {
  const { version } = chrome.runtime.getManifest();
  return (
    <section className="card p-6">
      <h2 className="text-base font-bold">關於</h2>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-slate-500">版本</dt>
        <dd>{version}</dd>
        <dt className="text-slate-500">作者</dt>
        <dd>{AUTHOR.name}</dd>
        <dt className="text-slate-500">聯絡</dt>
        <dd>
          <a className="text-brand-600 hover:underline dark:text-brand-100" href={`mailto:${AUTHOR.email}`}>
            {AUTHOR.email}
          </a>
        </dd>
        <dt className="text-slate-500">原始碼</dt>
        <dd>
          <a className="text-brand-600 hover:underline dark:text-brand-100" href={AUTHOR.repo} target="_blank" rel="noreferrer">
            {AUTHOR.repo.replace('https://', '')}
          </a>
        </dd>
        <dt className="text-slate-500">授權</dt>
        <dd>Apache License 2.0</dd>
      </dl>
    </section>
  );
}
