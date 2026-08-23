import { expect, type Page } from "@playwright/test";

export function skipUnlessE2eConfigured() {
  return (
    !process.env.E2E_BASE_URL ||
    !process.env.E2E_FULL_FLOW ||
    !process.env.E2E_TEST_EMAIL ||
    !process.env.E2E_TEST_PASSWORD
  );
}

export async function jobIdFromResponse(response: { json(): Promise<unknown> }) {
  const payload = (await response.json()) as { data?: { jobId?: string }; jobId?: string };
  const jobId = payload.data?.jobId ?? payload.jobId;
  if (!jobId) throw new Error("API response did not contain a generation job id");
  return jobId;
}

export async function waitForJob(page: Page, jobId: string, expected = "COMPLETED") {
  await expect
    .poll(
      async () => {
        const response = await page.request.get(`/api/v1/generation-jobs/${encodeURIComponent(jobId)}`);
        if (!response.ok()) return `HTTP_${response.status()}`;
        const payload = (await response.json()) as { data?: { status?: string }; status?: string };
        return payload.data?.status ?? payload.status ?? "UNKNOWN";
      },
      { timeout: 120_000, intervals: [500, 1_000, 2_000, 5_000] },
    )
    .toBe(expected);
}

export async function createProjectAndChapter(page: Page) {
  await page.goto("/projects");
  await page.getByRole("button", { name: /Tạo dự án mới/i }).click();
  await page.getByLabel("Tên dự án").fill(`E2E Story ${Date.now()}`);
  await page.getByRole("button", { name: "Tạo dự án", exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/\d+/);
  await page.getByRole("button", { name: "Add Chapter", exact: true }).click();
  await page.getByLabel("Tiêu đề Chapter").fill("Chapter E2E");
  await page.getByLabel("Nhập nội dung Chapter").fill(
    "Một người kể chuyện bước vào căn phòng đầy ánh sáng. Cô nhìn thấy con đường phía trước và bắt đầu chuyến hành trình.",
  );
  await page.getByRole("button", { name: "Thêm Chapter", exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/\d+\/chapters\/\d+/);
  const match = page.url().match(/\/projects\/(\d+)\/chapters\/(\d+)/);
  if (!match) throw new Error("Chapter route did not contain project and chapter ids");
  return { projectId: Number(match[1]), chapterId: Number(match[2]) };
}

export async function waitForMediaDetails(page: Page, jobId: string) {
  return expect
    .poll(
      async () => {
        const response = await page.request.get(`/api/v1/media-jobs/${encodeURIComponent(jobId)}`);
        if (!response.ok()) return null;
        const payload = (await response.json()) as { data?: { readyItems?: number; totalItems?: number; reviewItems?: number; items?: unknown[] } };
        const details = payload.data;
        return details && details.readyItems === details.totalItems && details.reviewItems === details.totalItems ? details : null;
      },
      { timeout: 120_000, intervals: [500, 1_000, 2_000, 5_000] },
    )
    .not.toBeNull();
}
