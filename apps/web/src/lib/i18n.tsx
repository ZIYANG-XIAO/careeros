"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";

export type Locale = "en" | "zh-CN";

const messages = {
  en: {
    "shell.tagline": "Job search workspace",
    "shell.workspace": "Workspace",
    "shell.jobs": "Jobs",
    "shell.applications": "Applications",
    "shell.resumes": "Resumes",
    "shell.profile": "Profile",
    "shell.yourWorkspace": "Your workspace",
    "shell.account": "Account and sign out",
    "shell.language": "Language",
    "shell.primaryNav": "Primary navigation",
    "shell.openMenu": "Open menu",
    "shell.closeMenu": "Close menu",
    "jobs.discover": "Discover",
    "jobs.title": "Jobs",
    "jobs.intro":
      "Browse opportunities you have brought into CareerOS. Apply directly, save what matters, or choose deeper analysis when you want it.",
    "jobs.addManual": "Add a job manually",
    "jobs.addManualHint": "For jobs you already found elsewhere",
    "jobs.searchArea": "Search jobs",
    "jobs.search": "Search",
    "jobs.searchPlaceholder": "Job title or company",
    "jobs.location": "Location",
    "jobs.locationPlaceholder": "Remote, city, or region",
    "jobs.searchAction": "Search jobs",
    "jobs.searching": "Searching…",
    "jobs.market": "Market",
    "jobs.allMarkets": "All markets",
    "jobs.northAmerica": "North America",
    "jobs.china": "China",
    "jobs.country": "Country",
    "jobs.allCountries": "All countries",
    "jobs.us": "United States",
    "jobs.ca": "Canada",
    "jobs.cn": "China",
    "jobs.workplace": "Workplace",
    "jobs.allWorkplaces": "All workplaces",
    "jobs.remote": "Remote",
    "jobs.hybrid": "Hybrid",
    "jobs.onsite": "On-site",
    "jobs.employment": "Employment type",
    "jobs.allEmployment": "All employment types",
    "jobs.fullTime": "Full-time",
    "jobs.partTime": "Part-time",
    "jobs.contract": "Contract",
    "jobs.internship": "Internship",
    "jobs.sort": "Sort",
    "jobs.recent": "Recently added",
    "jobs.titleSort": "Job title",
    "jobs.allJobs": "All jobs",
    "jobs.savedJobs": "Saved jobs",
    "jobs.clearFilters": "Clear filters",
    "jobs.yourJobs": "Your jobs",
    "jobs.job": "job",
    "jobs.jobs": "jobs",
    "jobs.noSaved": "No saved jobs yet",
    "jobs.noMatch": "No jobs match these filters",
    "jobs.ready": "Your Jobs workspace is ready",
    "jobs.noSavedHint":
      "Save an opportunity from the Jobs list or job detail to keep it here.",
    "jobs.noMatchHint": "Try broader search or filter choices.",
    "jobs.readyHint":
      "Add a job manually while production job sources are still being formed.",
    "jobs.requirements": "structured requirements",
    "jobs.apply": "Apply",
    "jobs.noApply": "Application link unavailable",
    "jobs.viewDetails": "View details",
    "jobs.save": "Save",
    "jobs.unsave": "Unsave",
    "jobs.company": "Company",
    "jobs.jobTitle": "Job title",
    "jobs.optionalLocation": "Location (optional)",
    "jobs.sourceUrl": "Source URL (optional)",
    "jobs.applicationUrl": "Application URL (optional)",
    "jobs.description": "Job description",
    "jobs.descriptionPlaceholder": "Paste the complete job description",
    "jobs.unknown": "Not specified",
    "jobs.manualPrivacy":
      "Manual jobs are private to your account and are not presented as live listings.",
    "jobs.addJob": "Add job",
    "jobs.parsing": "Parsing job…",
    "jobs.signIn": "Sign in to explore jobs.",
    "jobs.loadError": "We could not load your jobs. Please try again.",
    "jobs.saveError": "We could not update this saved job. Please try again.",
    "jobs.createError":
      "We could not parse this job description. Check the details and try again.",
  },
  "zh-CN": {
    "shell.tagline": "求职工作台",
    "shell.workspace": "工作台",
    "shell.jobs": "职位",
    "shell.applications": "申请记录",
    "shell.resumes": "简历",
    "shell.profile": "职业档案",
    "shell.yourWorkspace": "你的工作台",
    "shell.account": "账户与退出",
    "shell.language": "语言",
    "shell.primaryNav": "主导航",
    "shell.openMenu": "打开菜单",
    "shell.closeMenu": "关闭菜单",
    "jobs.discover": "发现机会",
    "jobs.title": "职位",
    "jobs.intro":
      "浏览你带入 CareerOS 的职位。你可以直接申请、收藏重点机会，或按需使用深度分析。",
    "jobs.addManual": "手动添加职位",
    "jobs.addManualHint": "适合你在其他地方发现的职位",
    "jobs.searchArea": "搜索职位",
    "jobs.search": "搜索",
    "jobs.searchPlaceholder": "职位名称或公司",
    "jobs.location": "地点",
    "jobs.locationPlaceholder": "远程、城市或地区",
    "jobs.searchAction": "搜索职位",
    "jobs.searching": "搜索中…",
    "jobs.market": "市场",
    "jobs.allMarkets": "全部市场",
    "jobs.northAmerica": "北美",
    "jobs.china": "中国",
    "jobs.country": "国家/地区",
    "jobs.allCountries": "全部国家/地区",
    "jobs.us": "美国",
    "jobs.ca": "加拿大",
    "jobs.cn": "中国",
    "jobs.workplace": "办公方式",
    "jobs.allWorkplaces": "全部办公方式",
    "jobs.remote": "远程",
    "jobs.hybrid": "混合办公",
    "jobs.onsite": "现场办公",
    "jobs.employment": "雇佣类型",
    "jobs.allEmployment": "全部雇佣类型",
    "jobs.fullTime": "全职",
    "jobs.partTime": "兼职",
    "jobs.contract": "合同工",
    "jobs.internship": "实习",
    "jobs.sort": "排序",
    "jobs.recent": "最近添加",
    "jobs.titleSort": "职位名称",
    "jobs.allJobs": "全部职位",
    "jobs.savedJobs": "已收藏",
    "jobs.clearFilters": "清除筛选",
    "jobs.yourJobs": "你的职位",
    "jobs.job": "个职位",
    "jobs.jobs": "个职位",
    "jobs.noSaved": "还没有收藏职位",
    "jobs.noMatch": "没有符合筛选条件的职位",
    "jobs.ready": "你的职位工作台已准备好",
    "jobs.noSavedHint": "在职位列表或详情页收藏机会后，会显示在这里。",
    "jobs.noMatchHint": "试试更宽泛的搜索词或筛选条件。",
    "jobs.readyHint": "正式招聘数据源接入前，你可以先手动添加职位。",
    "jobs.requirements": "项结构化要求",
    "jobs.apply": "申请",
    "jobs.noApply": "暂无申请链接",
    "jobs.viewDetails": "查看详情",
    "jobs.save": "收藏",
    "jobs.unsave": "取消收藏",
    "jobs.company": "公司",
    "jobs.jobTitle": "职位名称",
    "jobs.optionalLocation": "地点（选填）",
    "jobs.sourceUrl": "来源链接（选填）",
    "jobs.applicationUrl": "申请链接（选填）",
    "jobs.description": "职位描述",
    "jobs.descriptionPlaceholder": "粘贴完整职位描述",
    "jobs.unknown": "未注明",
    "jobs.manualPrivacy": "手动添加的职位仅你可见，不会被标记为实时招聘信息。",
    "jobs.addJob": "添加职位",
    "jobs.parsing": "解析中…",
    "jobs.signIn": "登录后浏览职位。",
    "jobs.loadError": "职位加载失败，请重试。",
    "jobs.saveError": "收藏状态更新失败，请重试。",
    "jobs.createError": "职位描述解析失败，请检查内容后重试。",
  },
} as const;

export type MessageKey = keyof (typeof messages)["en"];

type I18nValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey) => string;
};

const defaultValue: I18nValue = {
  locale: "en",
  setLocale: () => undefined,
  t: (key) => messages.en[key],
};

const I18nContext = createContext<I18nValue>(defaultValue);
const STORAGE_KEY = "careeros.locale";

export function LocaleProvider({
  children,
  initialLocale = "en",
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  function setLocale(next: Locale) {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    document.cookie = `careeros_locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    document.documentElement.lang = next;
  }

  const value = useMemo<I18nValue>(
    () => ({ locale, setLocale, t: (key) => messages[locale][key] }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
