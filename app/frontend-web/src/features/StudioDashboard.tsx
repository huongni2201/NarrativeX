"use client";

import { useState } from "react";

import { EmptyState, MetricCard, StatusPill } from "@/components/ui";
import { api } from "@/lib/api";
import type { AspectRatio, Project } from "@/types";

const ratios: AspectRatio[] = ["16:9", "9:16", "1:1", "4:3", "3:4"];

export function StudioDashboard() {
  const [projectName, setProjectName] = useState("");
  const [selectedRatio, setSelectedRatio] = useState<AspectRatio>("16:9");
  const [project, setProject] = useState<Project | null>(null);
  const [notice, setNotice] = useState("Local shell ready. Connect the API when you are ready to create a project.");
  const [isSaving, setIsSaving] = useState(false);

  async function createProject() {
    if (!projectName.trim()) {
      setNotice("Đặt tên project trước khi bắt đầu.");
      return;
    }
    setIsSaving(true);
    try {
      const created = await api.createProject({
        name: projectName.trim(),
        imageAspectRatio: selectedRatio,
        imageQualityTier: "STANDARD",
      });
      setProject(created);
      setNotice("Project đã tạo. Bước tiếp theo là paste story và chạy Analyze.");
    } catch {
      setNotice("Backend chưa kết nối — shell vẫn có thể được duyệt độc lập.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="shell-grid pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-[1440px] gap-8 px-5 py-5 lg:px-8">
        <aside className="hidden w-60 shrink-0 flex-col rounded-3xl border border-white/10 bg-[#0e111c]/90 p-5 lg:flex">
          <div className="flex items-center gap-3 border-b border-white/10 pb-6">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#d9f99d] font-black text-[#18220f]">N</div>
            <div><p className="text-sm font-black tracking-[0.16em] text-[#f5f4ee]">NARRATIVEX</p><p className="text-[10px] uppercase tracking-[0.18em] text-[#7f879b]">story studio</p></div>
          </div>
          <nav className="mt-8 space-y-2 text-sm">
            {([["01", "Overview", true], ["02", "Storyboard", false], ["03", "Characters", false], ["04", "Assets", false], ["05", "Shorts", false]] as const).map(([number, label, active]) => (
              <button className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left ${active ? "bg-white/10 text-[#d9f99d]" : "text-[#8d95a8] hover:bg-white/5 hover:text-white"}`} key={label} type="button">
                <span className="font-mono text-[10px] text-[#697186]">{number}</span>{label}
              </button>
            ))}
          </nav>
          <div className="mt-auto rounded-2xl border border-[#d9f99d]/20 bg-[#d9f99d]/5 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#d9f99d]">Free plan</p>
            <p className="mt-2 text-sm leading-5 text-[#d9dfd0]">1 long-form export · watermark on</p>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[28%] rounded-full bg-[#d9f99d]" /></div>
            <p className="mt-2 text-[11px] text-[#7f879b]">28 / 100 credits</p>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="flex items-start justify-between gap-4 py-2">
            <div><p className="text-xs font-bold uppercase tracking-[0.24em] text-[#d9f99d]">Creator workspace / vi-VN</p><h1 className="display-type mt-3 text-5xl leading-none text-[#f5f4ee] sm:text-6xl">Make the story visible.</h1><p className="mt-4 max-w-xl text-sm leading-6 text-[#9ca3b4]">Một studio image-first để đi từ truyện chữ đến storyboard có thể review, với character snapshot và cost guardrail ở từng bước.</p></div>
            <button type="button" className="hidden rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-[#c8cedc] hover:border-white/30 sm:block">EN / VI</button>
          </header>

          <div className="mt-10 grid gap-4 sm:grid-cols-3"><MetricCard label="Active projects" value={project ? "01" : "00"} detail="Project snapshot, not a blank table" /><MetricCard label="AI credits" value="28" detail="Estimates shown before expensive work" /><MetricCard label="Last render" value="—" detail="Notifications persist when tab is closed" /></div>

          <div className="mt-8 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
            <section className="rounded-3xl border border-white/10 bg-[#10131f]/85 p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7f879b]">Start here · 01</p><h2 className="display-type mt-3 text-4xl text-[#f5f4ee]">Create a project</h2></div><StatusPill label="DRAFT · safe to explore" tone="acid" /></div>
              <div className="mt-8 grid gap-5 sm:grid-cols-[1fr_auto]">
                <label className="block"><span className="text-xs font-semibold text-[#c8cedc]">Project name</span><input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="e.g. The Lantern Keeper" className="mt-2 w-full rounded-2xl border border-white/10 bg-[#090b13] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[#555e72] focus:border-[#d9f99d]/60 focus:ring-2 focus:ring-[#d9f99d]/10" /></label>
                <div><p className="text-xs font-semibold text-[#c8cedc]">Output frame</p><div className="mt-2 flex gap-2 rounded-2xl border border-white/10 bg-[#090b13] p-2">{ratios.map((ratio) => <button key={ratio} type="button" onClick={() => setSelectedRatio(ratio)} className={`rounded-xl px-3 py-2 text-xs font-semibold ${selectedRatio === ratio ? "bg-[#d9f99d] text-[#18220f]" : "text-[#9ca3b4] hover:bg-white/10"}`}>{ratio}</button>)}</div></div>
              </div>
              <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-5"><p className="max-w-lg text-xs leading-5 text-[#7f879b]">Bước tiếp theo: paste story, xác nhận quyền sử dụng, rồi Analyze. Provider call chưa được thực hiện ở màn hình này.</p><button type="button" disabled={isSaving} onClick={createProject} className="rounded-full bg-[#d9f99d] px-5 py-3 text-sm font-bold text-[#1a2510] transition hover:bg-[#ecfccb] disabled:cursor-wait disabled:opacity-60">{isSaving ? "Saving…" : "Create project →"}</button></div>
              <p className="mt-4 text-xs text-[#9ca3b4]">{notice}</p>
            </section>

            <aside className="rounded-3xl border border-white/10 bg-[#151321]/85 p-6"><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#f0b67f]">Workflow guardrails</p><h2 className="display-type mt-3 text-3xl text-[#f5f4ee]">A calm handoff.</h2><ul className="mt-7 space-y-5">{["Story stays untrusted data", "Character versions are snapshots", "Every regenerate creates an attempt", "Cost is estimated before queueing"].map((item, index) => <li className="flex gap-3 text-sm leading-5 text-[#c8cedc]" key={item}><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-[#f0b67f]/40 text-[10px] font-bold text-[#f0b67f]">0{index + 1}</span>{item}</li>)}</ul></aside>
          </div>

          <section className="mt-6">{project ? <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6"><div className="flex items-center justify-between"><div><p className="text-[11px] uppercase tracking-[0.2em] text-[#7f879b]">Recent project</p><h2 className="mt-2 text-xl font-semibold">{project.name || project.title}</h2></div><StatusPill label={project.status || "DRAFT"} tone="acid" /></div><p className="mt-4 text-sm text-[#9ca3b4]">Frame {selectedRatio} · Image quality STANDARD · Story input pending</p></div> : <EmptyState eyebrow="No projects yet" title="Your first story is waiting." description="Dashboard rỗng là một lời mời hành động: tạo project, paste story, chọn profile, rồi Analyze." action="Create your first project" onAction={() => document.querySelector("input")?.focus()} />}</section>
        </section>
      </div>
    </main>
  );
}
