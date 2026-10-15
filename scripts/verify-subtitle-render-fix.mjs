// Isolated legacy fixture: real Electron/IPC/backend/PostgreSQL/FFmpeg. Only
// native file/folder picker choices are automated; no bridge or job is faked.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const backend = process.env.SUBTITLE_TEST_BACKEND_URL;
assert.equal(backend, "http://127.0.0.1:58080");
const container = "narrativex-subtitle-fix-verification";
assert.equal(execFileSync("docker", ["inspect", "--format", '{{index .Config.Labels "purpose"}}', container], {encoding:"utf8", windowsHide:true}).trim(), container);
const root = resolve(import.meta.dirname, "..");
const output = join(root, ".tmp", "subtitle-render-fix");
const temporary = join(output, "electron-temp"), destination = join(output, "export");
await mkdir(temporary, {recursive:true}); await mkdir(destination, {recursive:true});
const ffmpeg = join(root, "app/desktop/resources/ffmpeg/ffmpeg.exe");
const still = join(output, "fixture.png"), audio = join(output, "fixture.wav");
const runFfmpeg = (args) => execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", ...args], {windowsHide:true, maxBuffer:10_000_000});
runFfmpeg(["-f","lavfi","-i","color=black:s=1280x720","-frames:v","1","-y",still]);
runFfmpeg(["-f","lavfi","-i","sine=frequency=440:sample_rate=48000:duration=1","-ac","2","-c:a","pcm_s16le","-y",audio]);
const sql = (text) => execFileSync("docker", ["exec","-i",container,"psql","-U","subtitle_test","-d","subtitle_fix_verification","-At","-v","ON_ERROR_STOP=1"],
  {input:text, encoding:"utf8", windowsHide:true}).trim();
const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
const uuid = () => sql("SELECT uuidv7();");
const mediaId = uuid(), narrationId = uuid(), requestId = uuid(), alignmentId = uuid();
const imageBytes = await readFile(still), audioBytes = await readFile(audio);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const text = "Xin chào", sourceHash = sha(Buffer.from(text));
const env = {...process.env, TEMP:temporary, TMP:temporary, NARRATIVEX_BACKEND_URL:backend, NARRATIVEX_DESKTOP_PROJECT_RENDER_ENABLED:"true"};
delete env.ELECTRON_RUN_AS_NODE;
const report = {status:"RUNNING", scope:"Isolated legacy alignment fixture; no GPU/provider health claim", consoleErrors:[], output:[]};
const app = await _electron.launch({executablePath:join(root,"app/desktop/node_modules/electron/dist/electron.exe"),
  args:[join(root,"app/desktop"),"--disable-gpu","--no-sandbox"], cwd:join(root,"app/desktop"), env, timeout:20_000});
let page;
try {
  page = await app.firstWindow();
  page.on("pageerror", (error) => report.consoleErrors.push(error.message));
  await page.getByRole("button", {name:"New project",exact:true}).waitFor({timeout:20_000});
  const fixture = await page.evaluate(async () => {
    const call = async (path, body) => {
      const response = await window.narrativex.api.request({path,method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":crypto.randomUUID()},body:JSON.stringify(body)});
      if (response.status !== 201) throw new Error(response.bodyText);
      return JSON.parse(response.bodyText).data;
    };
    const project = await call("/api/v1/projects",{name:"Subtitle render regression",sourceLanguage:"vi",narrationLanguage:"vi",metadataLanguage:"vi",imageAspectRatio:"16:9"});
    await window.narrativex.localProjects.upsert(project);
    const chapter = await call(`/api/v1/projects/${project.id}/chapters`,{title:"Legacy caption fixture",sourceText:"Xin chào"});
    return {project,chapter};
  });
  await app.evaluate(({dialog}, choices) => {
    const files = [...choices.files];
    dialog.showOpenDialog = async (...args) => ({canceled:false,filePaths:args.at(-1).properties?.includes("openDirectory") ? [choices.destination] : [files.shift()]});
  }, {files:[still,audio],destination});
  const local = await page.evaluate(async ({projectId,mediaId,narrationId}) => {
    const image = await window.narrativex.localStorage.selectAsset();
    const media = await window.narrativex.localStorage.commitSelectedAsset({projectId,assetId:mediaId,kind:"IMAGE",selectionToken:image.selectionToken});
    const sound = await window.narrativex.localStorage.selectAsset();
    const narration = await window.narrativex.localStorage.commitSelectedAsset({projectId,assetId:narrationId,kind:"AUDIO",selectionToken:sound.selectionToken});
    return {media,narration};
  }, {projectId:fixture.project.id,mediaId,narrationId});
  const p = literal(fixture.project.id), c = literal(fixture.chapter.id);
  const revision = uuid(), scene = uuid(), beat = uuid(), storyBeat = uuid();
  sql(`BEGIN;
INSERT INTO storyboard_revisions(id,chapter_id,revision_number,source_hash,source_row_version) VALUES (${literal(revision)},${c},1,${literal(sourceHash)},0);
UPDATE chapters SET current_storyboard_revision_id=${literal(revision)},status='READY',estimated_duration_ms=1000 WHERE id=${c};
INSERT INTO scenes(id,chapter_id,storyboard_revision_id,project_id,order_index,title) VALUES (${literal(scene)},${c},${literal(revision)},${p},0,'Scene');
INSERT INTO story_beats(id,scene_id,order_index,summary,review_status) VALUES (${literal(storyBeat)},${literal(scene)},0,'Greeting','APPROVED');
INSERT INTO media_assets(id,project_id,asset_type,origin,status,storage_key,original_filename,content_type,size_bytes,sha256) VALUES (${literal(mediaId)},${p},'IMAGE','USER_UPLOAD','READY',${literal(local.media.relativePath)},'fixture.png','image/png',${imageBytes.length},${literal(sha(imageBytes))});
INSERT INTO visual_beats(id,scene_id,story_beat_id,order_index,title,visual_intent,review_status,text_start,text_end,preview_media_asset_id) VALUES (${literal(beat)},${literal(scene)},${literal(storyBeat)},0,'Greeting','Caption fixture','APPROVED',0,8,${literal(mediaId)});
INSERT INTO project_assets(id,project_id,name,asset_type,storage_key,mime_type,status,metadata_json) VALUES (${literal(narrationId)},${p},'fixture.wav','AUDIO',${literal(local.narration.relativePath)},'audio/wav','ACTIVE','{}'::jsonb);
INSERT INTO narration_requests(id,project_id,chapter_id,chapter_row_version,source_hash,source_text,voice_id,language,speaking_rate,segmentation_version,request_fingerprint) VALUES (${literal(requestId)},${p},${c},0,${literal(sourceHash)},'Xin chào','fixture','vi',1,'v1',${literal(sha(Buffer.from(fixture.project.id)))});
INSERT INTO narration_assets(id,narration_request_id,project_asset_id,duration_ms,size_bytes,codec,sample_rate_hz,channels,checksum) VALUES (${literal(narrationId)},${literal(requestId)},${literal(narrationId)},1000,${audioBytes.length},'PCM_S16LE',48000,2,${literal(sha(audioBytes))});
INSERT INTO narration_alignments(id,narration_asset_id,source_hash,alignment_version,words_json) VALUES (${literal(alignmentId)},${literal(narrationId)},${literal(sourceHash)},'whisperx-forced-v1','[{"index":0,"textStart":0,"textEnd":3,"audioStartMs":120,"audioEndMs":420,"confidence":0.99},{"index":1,"textStart":4,"textEnd":8,"audioStartMs":500,"audioEndMs":880,"confidence":0.98}]');
COMMIT;`);
  await page.evaluate((id) => {location.hash=`/projects/${id}/editor`;},fixture.project.id);
  await page.getByRole("button",{name:"Render",exact:true}).click();
  await page.getByText("Đã lưu theo Project",{exact:true}).waitFor();
  const setColor = async (color) => page.getByLabel("Màu chữ",{exact:true}).evaluate((input, selected) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,selected);
    input.dispatchEvent(new Event("input",{bubbles:true})); input.dispatchEvent(new Event("change",{bubbles:true}));
  },color);
  for (const color of ["#ffffff","#ffcc00"]) {
    await setColor(color);
    await page.getByRole("button",{name:/Choose folder|Change/,exact:true}).click();
    await page.getByRole("button",{name:"Render video",exact:true}).click();
    await page.getByText(/Render hoàn tất:/).waitFor({timeout:60_000});
    const rows = sql(`SELECT json_build_object('jobId',gj.job_id,'color',s.render_profile_json->'subtitles'->'style'->>'primaryColor') FROM project_render_input_snapshots s JOIN generation_jobs gj ON gj.id=s.generation_job_id WHERE s.project_id=${p} ORDER BY gj.created_at;`).split("\n").filter(Boolean).map(JSON.parse);
    const last = rows.at(-1); assert.equal(last.color,color.toUpperCase());
    const completion = await page.getByText(/Render hoàn tất:/).innerText();
    const file = completion.match(/Render hoàn tất: (.+?\.mp4)(?:\s|$)/)?.[1];
    assert.ok(file, "Completion notice includes the delivered video path");
    const pixels = runFfmpeg(["-ss","0.5","-i",file,"-frames:v","1","-f","rawvideo","-pix_fmt","rgb24","pipe:1"]);
    let whites=0,yellows=0;
    for(let i=0;i<pixels.length;i+=3) {if(pixels[i]>180&&pixels[i+1]>180&&pixels[i+2]>180)whites++; if(pixels[i]>160&&pixels[i+1]>100&&pixels[i+2]<90)yellows++;}
    if(color==="#ffffff") assert.ok(whites>20); else assert.ok(yellows>20);
    report.output.push({...last,file,whites,yellows});
  }
  assert.notEqual(report.output[0].jobId,report.output[1].jobId);
  assert.equal(report.consoleErrors.length,0);
  await page.screenshot({path:join(output,"completed-second-export.png"),fullPage:true});
  report.status="PASS";
} catch(error) {
  report.status="FAILED";report.error=error.message;
  report.visibleState=page ? (await page.locator("body").innerText()).slice(-3000) : null;
  if(page) await page.screenshot({path:join(output,"failed-export.png"),fullPage:true});
  throw error;
}
finally {await writeFile(join(output,"report.json"),JSON.stringify(report,null,2));await app.close();console.log(JSON.stringify(report));}
