/**
 * Extension copy localization. Strings are written in English at the call
 * site (gettext style) and looked up in the catalog for other locales, so a
 * missing translation falls back to English instead of showing a raw key.
 * The locale follows the browser UI language; job market never changes it.
 */

export type ExtensionLocale = "en" | "zh-CN";
export type CopyParams = Record<string, string | number>;

let localeOverride: ExtensionLocale | null = null;

export function setExtensionLocale(locale: ExtensionLocale | null): void {
  localeOverride = locale;
}

export function extensionLocale(): ExtensionLocale {
  if (localeOverride) return localeOverride;
  let language = "";
  try {
    language =
      typeof chrome !== "undefined" && chrome.i18n?.getUILanguage
        ? chrome.i18n.getUILanguage()
        : "";
  } catch {
    language = "";
  }
  if (!language && typeof navigator !== "undefined") {
    language = navigator.language ?? "";
  }
  return language.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}

export function t(text: string, params?: CopyParams): string {
  const template = extensionLocale() === "zh-CN" ? (ZH_CN[text] ?? text) : text;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export function fillButtonLabel(
  prepareForRecovery: boolean,
  count: number,
): string {
  const text = prepareForRecovery
    ? count === 1
      ? "Save context & fill {count} approved field"
      : "Save context & fill {count} approved fields"
    : count === 1
      ? "Fill {count} approved field"
      : "Fill {count} approved fields";
  return t(text, { count });
}

export const ZH_CN: Readonly<Record<string, string>> = {
  // Popup chrome and status
  "APPLY ANYWHERE": "随处申请",
  "CURRENT PAGE": "当前页面",
  "ANSWER POLICY": "回答策略",
  "APPLICATION MEMORY": "申请记录",
  REVIEW: "检查",
  "SAVE JOB": "保存职位",
  "SAVED JOB": "已保存职位",
  "SAVED ANSWERS": "已保存的回答",
  "Checking account…": "正在检查账户…",
  "Connected to CareerOS": "已连接 CareerOS",
  "Sign in to CareerOS": "登录 CareerOS",
  "Your Career Brain stays in the secure CareerOS service.":
    "你的 Career Brain 始终保存在安全的 CareerOS 服务中。",
  "CareerOS never submits an application for you.":
    "CareerOS 永远不会替你提交申请。",
  "CareerOS never submits the application for you.":
    "CareerOS 永远不会替你提交申请。",
  "Build {version}": "版本 {version}",
  "Connection issue —": "连接问题 —",
  "check setup guide": "查看安装指南",
  "CareerOS is unavailable.": "CareerOS 暂不可用。",
  "Open assistant on page": "在页面上打开助手",
  "Opening assistant on page…": "正在页面上打开助手…",
  "Open CareerOS to sign in": "打开 CareerOS 登录",
  "The in-page assistant could not be opened.": "无法打开页面助手。",
  "Open a normal web page first.": "请先打开一个普通网页。",

  // Tab and page state
  "Could not identify the active tab. Close and reopen the popup.":
    "无法识别当前标签页。请关闭并重新打开弹窗。",
  "No active tab identified. Close and reopen the popup.":
    "未识别到当前标签页。请关闭并重新打开弹窗。",
  "Open a normal web page to use CareerOS.":
    "请打开一个普通网页来使用 CareerOS。",
  "This tab changed. Close and reopen the popup.":
    "标签页已变化。请关闭并重新打开弹窗。",
  "This page could not be inspected.": "无法检查此页面。",
  "Checking this page…": "正在检查此页面…",
  "CareerOS only inspects the active tab when you open it.":
    "CareerOS 只在你打开弹窗时检查当前标签页。",
  "Page context is unavailable. Close the popup and try again.":
    "页面上下文不可用。请关闭弹窗后重试。",
  "This page changed. Close the popup and reopen on the application page.":
    "页面已变化。请关闭弹窗，并在申请页面上重新打开。",

  // Detection copy
  "Application form needs manual review": "申请表需要手动检查",
  "{count} fields were found, but none can be identified reliably yet. Nothing changes until you act.":
    "找到 {count} 个字段，但暂时都无法可靠识别。在你操作之前不会有任何改动。",
  "Application form inspected": "已检查申请表",
  "Form inspection succeeded. {recognized} field recognized. Nothing changes until you act.":
    "表单检查完成：识别出 {recognized} 个字段。在你操作之前不会有任何改动。",
  "Form inspection succeeded. {recognized} fields recognized. Nothing changes until you act.":
    "表单检查完成：识别出 {recognized} 个字段。在你操作之前不会有任何改动。",
  "Form inspection succeeded. {recognized} field recognized · {review} need manual review. Nothing changes until you act.":
    "表单检查完成：识别出 {recognized} 个字段 · {review} 个需要手动检查。在你操作之前不会有任何改动。",
  "Form inspection succeeded. {recognized} fields recognized · {review} need manual review. Nothing changes until you act.":
    "表单检查完成：识别出 {recognized} 个字段 · {review} 个需要手动检查。在你操作之前不会有任何改动。",
  "This page is not supported": "不支持此页面",
  "Open a normal web application page and try again.":
    "请打开一个普通的网页申请页面后重试。",
  "No application detected": "未检测到申请表",
  "CareerOS did not find a likely application form on this page.":
    "CareerOS 没有在此页面找到申请表。",

  // Answer decisions
  "Checking approved sources…": "正在检查已确认的信息来源…",
  "CareerOS keeps unknown and sensitive answers under your control.":
    "未知和敏感的回答始终由你决定。",
  "Answer decisions are unavailable.": "暂时无法生成回答建议。",
  "Sign in to preview safe answers.": "登录后可预览安全的回答。",
  "Answer decisions ready": "回答建议已就绪",
  "{count} approved for fill": "{count} 个可自动填写",
  "{count} need input": "{count} 个需要你填写",
  "{count} need confirmation": "{count} 个需要确认",
  "{count} need review": "{count} 个需要检查",
  "{count} unresolved": "{count} 个未解决",
  "No answers resolved": "没有可用的回答",
  "{details}. Nothing was filled.": "{details}。尚未填写任何内容。",

  // Fill
  "Saving recovery context…": "正在保存恢复信息…",
  "Applying approved answers…": "正在填写已确认的回答…",
  "Fill {count} approved field": "填写 {count} 个已确认字段",
  "Fill {count} approved fields": "填写 {count} 个已确认字段",
  "Save context & fill {count} approved field":
    "保存上下文并填写 {count} 个已确认字段",
  "Save context & fill {count} approved fields":
    "保存上下文并填写 {count} 个已确认字段",
  "Save context & show review states": "保存上下文并标记待检查字段",
  "Show review states on page": "在页面上标记待检查字段",
  "Updating supported fields…": "正在更新支持的字段…",
  "Existing answers stay untouched, and CareerOS never submits the form.":
    "已有的回答不会被改动，CareerOS 也永远不会提交表单。",
  "Review the application page": "请检查申请页面",
  "{count} filled": "已填写 {count} 个",
  "{count} existing value untouched": "{count} 个已有内容未改动",
  "{count} existing values untouched": "{count} 个已有内容未改动",
  "{count} need your review": "{count} 个需要你检查",
  "No fields changed": "没有字段被改动",
  "{details}. CareerOS never submits the form.":
    "{details}。CareerOS 永远不会提交表单。",
  "The page could not be updated.": "无法更新页面。",
  "This page changed before fill could finish.": "填写完成前页面已变化。",
  "This page changed before fill could finish. Close the popup and try again.":
    "填写完成前页面已变化。请关闭弹窗后重试。",
  "CareerOS could not save recovery context, but you can still fill and submit manually.":
    "CareerOS 无法保存恢复信息，但你仍可以手动填写并提交。",

  // Application memory
  "Looking for tracked context…": "正在查找已记录的申请…",
  "Application context is unavailable.": "申请上下文不可用。",
  "Sign in to record this application.": "登录后可记录这次申请。",
  "Application recorded": "申请已记录",
  "Record after you submit": "提交后再记录",
  "CareerOS matched the application you started. Confirm after you submit the form.":
    "CareerOS 匹配到了你开始的申请。请在提交表单后确认。",
  "CareerOS found one recent application. Review the company and role before confirming.":
    "CareerOS 找到一条最近的申请。确认前请检查公司和职位。",
  "No tracked job matched this page. Review the suggested context before confirming.":
    "没有与此页面匹配的已记录职位。确认前请检查建议的信息。",
  "Choosing fill saves this reviewed context as Preparing so it can be recovered after a submit redirect.":
    "选择填写会把这些已检查的信息保存为「准备中」，以便提交后页面跳转时恢复。",
  Company: "公司",
  Role: "职位",
  "Resume used": "使用的简历",
  "No resume recorded": "未记录简历",
  "Recording application…": "正在记录申请…",
  "I submitted · Record application": "我已提交 · 记录申请",
  "I submitted — Record application": "我已提交 — 记录申请",
  "Click only after you submit the form yourself. CareerOS never clicks Submit.":
    "请在你亲自提交表单后再点击。CareerOS 从不点击提交。",
  "View in CareerOS": "在 CareerOS 中查看",
  "Open in CareerOS": "在 CareerOS 中打开",
  "Sign in and keep this application page open to save durable context.":
    "登录并保持此申请页面打开，以保存申请记录。",
  "Sign in and keep this application page open.": "登录并保持此申请页面打开。",
  "CareerOS could not record this application. Your details remain here so you can retry.":
    "CareerOS 无法记录这次申请。你填写的信息仍保留在这里，可以重试。",
  "Use the recent {company} · {role} record":
    "使用最近的 {company} · {role} 记录",

  // Job clipper
  "Sign in to CareerOS to save jobs.": "登录 CareerOS 以保存职位。",
  "Open a normal web page to save a job.": "请打开一个普通网页来保存职位。",
  "This page could not be read.": "无法读取此页面。",
  "Add the job title.": "请填写职位名称。",
  "Add the company.": "请填写公司。",
  "Add the job description (at least 20 characters).":
    "请填写职位描述（至少 20 个字符）。",
  "CareerOS could not save this job. Check the description and try again.":
    "CareerOS 无法保存此职位。请检查描述后重试。",
  "Reading this job…": "正在读取职位…",
  "Save this job": "保存此职位",
  "Saved to CareerOS": "已保存到 CareerOS",
  "Already in CareerOS": "已在 CareerOS 中",
  "It is in your saved jobs in Discover.": "它在 Discover 的已保存职位中。",
  "Try again": "重试",
  "Check before saving": "保存前请检查",
  "Read from this page's job listing data.": "已从此页面的职位数据中读取。",
  "No structured job data found — fields were guessed from page text. Please check them.":
    "未找到结构化职位数据——字段是根据页面文字推测的，请检查。",
  Title: "职位名称",
  Location: "地点",
  Description: "职位描述",
  "Saving…": "正在保存…",
  "Save to CareerOS": "保存到 CareerOS",

  // Saved answers
  "Saved {count} answer for next time.": "已保存 {count} 条回答，下次可复用。",
  "Saved {count} answers for next time.": "已保存 {count} 条回答，下次可复用。",
  "{count} sensitive question was not saved — CareerOS always asks you those.":
    "{count} 个敏感问题未保存——这类问题 CareerOS 每次都会询问你。",
  "{count} sensitive questions were not saved — CareerOS always asks you those.":
    "{count} 个敏感问题未保存——这类问题 CareerOS 每次都会询问你。",
  "No answered custom questions found on this page yet.":
    "此页面上还没有已回答的自定义问题。",
  "Sign in to CareerOS to save answers.": "登录 CareerOS 以保存回答。",
  "CareerOS could not save answers.": "CareerOS 无法保存回答。",
  "Reading your answers…": "正在读取你的回答…",
  "Remember my answers on this page": "记住我在此页面的回答",
  "Choose answers to reuse": "选择要复用的回答",
  "CareerOS will fill these on future forms that ask the same question. You can remove them anytime in CareerOS → Me → Contact & answers.":
    "以后遇到相同的问题时，CareerOS 会自动填写这些回答。你可以随时在 CareerOS → 我 → 联系方式与回答 中删除。",
  "Save {count} answer": "保存 {count} 条回答",
  "Save {count} answers": "保存 {count} 条回答",

  // Resume attach
  "Resume attached. Check it on the page before you submit.":
    "简历已附加。提交前请在页面上检查。",
  "A file is already chosen — CareerOS left it unchanged.":
    "已选择了文件——CareerOS 没有改动。",
  "This upload field is disabled. Attach the file yourself.":
    "此上传框不可用，请自行上传文件。",
  "Attach the file yourself.": "请自行上传文件。",
  "This site did not accept the file automatically. Attach it yourself.":
    "此网站不接受自动附加文件，请自行上传。",
  "The resume could not be attached.": "无法附加简历。",
  "Attaching resume…": "正在附加简历…",
  "Attach resume: {label}": "附加简历：{label}",
  "Choose a resume below to attach it": "请在下方选择要附加的简历",

  // In-page assistant
  "Open CareerOS assistant": "打开 CareerOS 助手",
  "Close CareerOS assistant": "关闭 CareerOS 助手",
  "CareerOS application assistant": "CareerOS 申请助手",
  Close: "关闭",
  "Current page": "当前页面",
  "Not inspected yet": "尚未检查",
  "Use Reinspect page when you are ready. CareerOS does not scan continuously.":
    "准备好后点击「重新检查页面」。CareerOS 不会持续扫描。",
  "CareerOS only inspects when you ask.": "CareerOS 只在你要求时检查。",
  "Answer policy": "回答策略",
  Review: "检查",
  "Application memory": "申请记录",
  "Reinspect page": "重新检查页面",

  // Markers CareerOS places next to fields on the application page
  "CareerOS filled — review": "CareerOS 已填写 — 请检查",
  "CareerOS needs your review": "CareerOS 需要你检查",
  "CareerOS needs your input": "CareerOS 需要你填写",
  "CareerOS left this unresolved": "CareerOS 未处理此项",
  "CareerOS kept your existing answer": "CareerOS 保留了你已有的回答",
  "CareerOS could not fill this field": "CareerOS 无法填写此字段",
};
