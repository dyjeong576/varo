import assert from "node:assert/strict";
import test from "node:test";
import { getSourcePoliticalLeanBadge } from "./source-political-lean";

test("style.txt 기준 주요 뉴스사 성향을 도메인으로 분류한다", () => {
  assert.equal(
    getSourcePoliticalLeanBadge({
      publisherName: null,
      canonicalUrl: "https://www.chosun.com/politics/test",
      originalUrl: "https://n.news.naver.com/mnews/article/023/0000000001",
    }).lean,
    "conservative",
  );
  assert.equal(
    getSourcePoliticalLeanBadge({
      publisherName: null,
      canonicalUrl: "https://biz.chosun.com/policy/test",
      originalUrl: "https://biz.chosun.com/policy/test",
    }).lean,
    "conservative",
  );
  assert.equal(
    getSourcePoliticalLeanBadge({
      publisherName: null,
      canonicalUrl: "https://www.hani.co.kr/arti/politics/test.html",
      originalUrl: "https://www.hani.co.kr/arti/politics/test.html",
    }).lean,
    "progressive",
  );
  assert.equal(
    getSourcePoliticalLeanBadge({
      publisherName: null,
      canonicalUrl: "https://www.yna.co.kr/view/AKR20260401000100001",
      originalUrl: "https://www.yna.co.kr/view/AKR20260401000100001",
    }).lean,
    "centrist",
  );
  assert.equal(
    getSourcePoliticalLeanBadge({
      publisherName: null,
      canonicalUrl: "https://www.ytn.co.kr/_ln/0101_202604010000000001",
      originalUrl: "https://www.ytn.co.kr/_ln/0101_202604010000000001",
    }).lean,
    "centrist",
  );
  assert.equal(
    getSourcePoliticalLeanBadge({
      publisherName: null,
      canonicalUrl: "https://imnews.imbc.com/news/test",
      originalUrl: "https://imnews.imbc.com/news/test",
    }).lean,
    "centrist",
  );
  assert.equal(
    getSourcePoliticalLeanBadge({
      publisherName: "중앙일보",
      canonicalUrl: "https://n.news.naver.com/mnews/article/025/0000000001",
      originalUrl: "https://n.news.naver.com/mnews/article/025/0000000001",
    }).lean,
    "centrist",
  );
  assert.equal(
    getSourcePoliticalLeanBadge({
      publisherName: null,
      canonicalUrl: "https://www.news1.kr/politics/test",
      originalUrl: "https://www.news1.kr/politics/test",
    }).lean,
    "other",
  );
  assert.equal(
    getSourcePoliticalLeanBadge({
      publisherName: null,
      canonicalUrl: "https://www.korea.kr/news/test",
      originalUrl: "https://www.korea.kr/news/test",
    }).lean,
    "other",
  );
  assert.equal(
    getSourcePoliticalLeanBadge({
      publisherName: null,
      canonicalUrl: "https://example.com/news/test",
      originalUrl: "https://example.com/news/test",
    }).lean,
    "other",
  );
});
