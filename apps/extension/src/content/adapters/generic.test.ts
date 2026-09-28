// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { detectApplicationPage } from "../detection";

function doc(html: string, lang = "zh-CN"): Document {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  parsed.documentElement.lang = lang;
  return parsed;
}

const FORMLESS_CN = `
<div id="app">
  <header><input type="search" placeholder="搜索职位" /></header>
  <section class="apply">
    <h2>网申 · 个人简历</h2>
    <div><label for="a">姓名</label><input id="a" type="text" /></div>
    <div><label for="b">手机号码</label><input id="b" type="tel" /></div>
    <div><label for="c">电子邮箱</label><input id="c" type="text" /></div>
    <div><label for="d">上传简历</label><input id="d" type="file" /></div>
    <button type="button">提交</button>
  </section>
</div>`;

describe("generic adapter without a <form>", () => {
  it("detects a formless China-market application and maps Chinese labels", () => {
    const detection = detectApplicationPage(
      doc(FORMLESS_CN),
      "https://app.example.cn/apply/123",
    );
    expect(detection.status).toBe("APPLICATION_PAGE");
    const keys = detection.forms[0].fields.map((field) => field.canonicalKey);
    expect(keys).toEqual(
      expect.arrayContaining([
        "PERSON_NATIVE_FULL_NAME",
        "CONTACT_PHONE",
        "CONTACT_EMAIL",
      ]),
    );
  });

  it("ignores a formless page with no application signal", () => {
    const detection = detectApplicationPage(
      doc(
        `<div><input type="text" /><input type="text" /><input type="text" /></div>`,
        "en",
      ),
      "https://news.example.com/settings",
    );
    expect(detection.status).toBe("NOT_APPLICATION_PAGE");
  });

  it("does not treat formless job-search filters as an application", () => {
    const detection = detectApplicationPage(
      doc(
        `<div><input placeholder="Keyword" /><input placeholder="City" />
           <select><option>Full time</option></select></div>`,
        "en",
      ),
      "https://example.com/careers",
    );
    expect(detection.status).toBe("NOT_APPLICATION_PAGE");
  });

  it("keeps using real forms when the page has them", () => {
    const detection = detectApplicationPage(
      doc(
        `<form><input name="q" /></form>
           <div><input /><input /><input /></div>`,
        "en",
      ),
      "https://example.com/careers/apply",
    );
    expect(detection.status).toBe("NOT_APPLICATION_PAGE");
  });
});
