"""Package committed local source and the offline page, without credentials or user notes."""
import argparse
import hashlib
import json
import re
import subprocess
import time
import zipfile
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--out", type=Path, required=True)
args = parser.parse_args()
out = args.out.resolve()
out.mkdir(parents=True, exist_ok=False)


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT)


if git("status", "--porcelain", "--untracked-files=no").strip():
    raise ValueError("Commit tracked source changes before packaging")
source = git("rev-parse", "HEAD").decode().strip()
commit_time = max(315532800, int(git("show", "-s", "--format=%ct", "HEAD")))
members = {}
for name in git("ls-files", "-z").decode().split("\0"):
    if not name:
        continue
    relative = PurePosixPath(name)
    if relative.is_absolute() or {".git", ".venv", "artifacts"}.intersection(relative.parts) or ".." in relative.parts:
        raise ValueError("Unexpected source path")
    data = git("show", "HEAD:" + name)
    members["source/" + name] = data
    if name.startswith("dist/"):
        members["app/" + name[len("dist/"):]] = data
catalog = json.loads(members["source/data/catalog.json"])
version = json.loads(members["source/STATUS.json"])["version"]
if not re.fullmatch(r"\d+\.\d+\.\d+(?:-local|a\d+)", version):
    raise ValueError("Use an explicit local prototype or alpha version")
if not version.endswith("-local"):
    release_notes = f"source/releases/v{version}.md"
    if not members.get(release_notes, b"").strip():
        raise ValueError(f"Commit non-empty release notes at releases/v{version}.md before packaging")
members["START_HERE.md"] = """# 打开研向

完整解压后，双击 app/index.html 即可使用。

1. 选学校、学位和入学轮次。打开项目卡片，核对联系导师的安排、申请材料和日期。
2. 在“搜索专业、院系和研究方向”中输入中文或英文名称。想了解老师的近期研究，可从卡片打开个人主页。
3. 将老师和准备事项加入“我的清单”。在同一浏览器继续使用，或下载完整备份，换设备时再载入。

已有格式 1、2 或 3 的备份，可以从“我的清单”载入。下载后请确认备份文件已保存。遇到导入错误时，保留原文件并按页面提示处理。

申请前，打开项目官网核对当年的材料、费用和日期。source/ 保留本包对应的目录及来源，方便日后查证。

网页入口 https://c4llm3luc4s.github.io/research-admissions-navigator/
""".encode()
info = {"version": version, "source_commit": source, "source_tree": git("rev-parse", "HEAD^{tree}").decode().strip(),
        "catalog_snapshot": catalog["snapshotId"], "publicly_deployed": None,
        "deployment_status": "not_checked_by_packager",
        "deployment_note": "网页入口可能更新；打包不证明这一份源码已经部署，需另核实际线上文件。",
        "web_entry": "https://c4llm3luc4s.github.io/research-admissions-navigator/", "contains_personal_profile": False}
if not version.endswith('-local'):
    info.update(repository_url="https://github.com/C4LLM3LUC4S/research-admissions-navigator", release_tag="v" + version,
                artifact_scope="Experimental offline alpha; partial evidence-linked coverage, no hosted feedback service")
members["BUILD_INFO.json"] = (json.dumps(info, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
manifest = {"source_commit": source, "files": {name: {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()} for name, data in members.items()}}
members["MANIFEST.json"] = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
archive = out / (("Yanxiang-local-prototype-" + version.removesuffix("-local") + ".zip") if version.endswith('-local') else ("Yanxiang-" + version + "-offline.zip"))
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zipped:
    for name, data in sorted(members.items()):
        entry = zipfile.ZipInfo(name, time.gmtime(commit_time)[:6])
        entry.create_system = 3
        entry.external_attr = 0o100644 << 16
        entry.compress_type = zipfile.ZIP_DEFLATED
        zipped.writestr(entry, data)
with zipfile.ZipFile(archive) as zipped:
    assert zipped.testzip() is None and set(zipped.namelist()) == set(members)
    for name, data in members.items():
        assert zipped.read(name) == data
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
checksums = [digest + "  " + archive.name]
if not version.endswith('-local'):
    release_info = out / "RELEASE_INFO.json"
    release_info.write_text(json.dumps({**info, "archive": archive.name, "bytes": archive.stat().st_size, "sha256": digest}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    checksums.append(hashlib.sha256(release_info.read_bytes()).hexdigest() + "  RELEASE_INFO.json")
(out / "SHA256SUMS").write_text("\n".join(checksums) + "\n", encoding="ascii", newline="\n")
(out / "summary.json").write_text(json.dumps({"status": "passed_local_package", **info, "members": len(members), "zip_sha256": digest,
    "scope": "Local committed package CRC, member bytes and hashes; no new UI/download/independent-user or public-release claim"}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"status": "passed", "archive": str(archive), "members": len(members)}))
