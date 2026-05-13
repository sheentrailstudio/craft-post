import Link from "next/link";

const settingsCards = [
  {
    title: "身份管理",
    label: "Identities",
    description: "建立品牌身份、設定預設身份，並管理每個身份底下的發布帳號。",
    href: "/app/settings/identities",
    action: "管理身份",
  },
  {
    title: "帳戶管理",
    label: "Account",
    description: "查看登入帳號、目前方案與使用限制，或登出目前工作階段。",
    href: "/app/settings/account",
    action: "查看帳戶",
  },
];

export default function SettingsHome() {
  return (
    <div className="mx-auto grid max-w-5xl gap-5">
      <header>
        <p className="text-label mb-2">Settings</p>
        <h1 className="text-h1 mb-3">設定</h1>
        <p className="text-body max-w-2xl">
          管理發布身份、社群帳號連結，以及目前帳戶的方案限制。
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {settingsCards.map((card) => (
          <Link className="surface card-interactive grid min-h-56 gap-5 p-6" href={card.href} key={card.href}>
            <div>
              <p className="text-label mb-3">{card.label}</p>
              <h2 className="text-h2 mb-3">{card.title}</h2>
              <p className="text-body">{card.description}</p>
            </div>
            <span className="btn btn-secondary mt-auto w-fit">{card.action}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
