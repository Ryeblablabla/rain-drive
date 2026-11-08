from pathlib import Path
import subprocess, re, json, os, shutil, argparse
parser=argparse.ArgumentParser(description='Join separately recorded electric and combustion game captures without text overlays or mixed vehicle audio.')
parser.add_argument('--input',default=os.environ.get('QA_OUTPUT','test-results/demo'),help='Directory produced by tests/record-demo.mjs')
parser.add_argument('--output',default='test-results/video')
parser.add_argument('--ffmpeg',default=os.environ.get('FFMPEG') or shutil.which('ffmpeg'))
args=parser.parse_args()
if not args.ffmpeg:parser.error('Install FFmpeg or pass --ffmpeg /path/to/ffmpeg')
demo=Path(args.input).resolve();out=Path(args.output).resolve();out.mkdir(parents=True,exist_ok=True)
work=demo;ffmpeg=Path(args.ffmpeg)
def run(args,check=True):
    r=subprocess.run([str(ffmpeg),'-hide_banner',*map(str,args)],cwd=work,capture_output=True,text=True,encoding='utf-8',errors='replace')
    if check and r.returncode: raise RuntimeError(r.stderr[-5000:])
    return r
durations=[]
for style in ['electric','combustion']:
    source=demo/f'rain-drive-{style}.webm'
    decode=run(['-i',source,'-map','0:v:0','-f','null','-'])
    (demo/f'{style}-media-info.txt').write_text(decode.stderr,encoding='utf-8')
    times=re.findall(r'time=(\d+):(\d+):(\d+\.\d+)',decode.stderr)
    h,m,s=map(float,times[-1]); durations.append(h*3600+m*60+s)
assert 100<sum(durations)<150, durations
# Sequential audiovisual concatenation: no crossfade or mixed vehicle tracks.
filters=[]
for i,d in enumerate(durations):
    filters += [f'[{i}:v]fps=60,setsar=1,setpts=PTS-STARTPTS,fade=t=in:st=0:d=0.25,fade=t=out:st={d-.25:.3f}:d=0.25[v{i}]',f'[{i}:a]aresample=48000,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.15,afade=t=out:st={d-.15:.3f}:d=0.15[a{i}]']
filters.append('[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]')
assert not any('drawtext' in f or 'subtitles' in f or 'amix' in f or 'acrossfade' in f for f in filters)
video=out/'雨落狂流之暗-纯演示.mp4'
encode=run(['-y','-i',demo/'rain-drive-electric.webm','-i',demo/'rain-drive-combustion.webm','-filter_complex',';'.join(filters),'-map','[v]','-map','[a]','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','256k','-ar','48000','-movflags','+faststart','-metadata','title=雨落狂流之暗','-metadata','comment=Actual game capture. Separate electric and combustion segments. https://github.com/Ryeblablabla/rain-drive',video])
(demo/'encode.txt').write_text(encode.stderr,encoding='utf-8')
cover=out/'雨落狂流之暗-纯画面封面.jpg'
run(['-y','-i',demo/'city-cruise.png','-frames:v','1','-q:v','2',cover])
for t in [2,30,39,64,88,108]:run(['-y','-ss',t,'-i',video,'-frames:v','1','-q:v','2',demo/f'video-{t}.jpg'])
audio=run(['-i',video,'-vn','-af','volumedetect','-f','null','-'])
(demo/'audio-levels.txt').write_text(audio.stderr,encoding='utf-8')
assert '1920x1080' in audio.stderr and 'Audio: aac' in audio.stderr
info={'file':str(video),'durationSeconds':sum(durations),'segments':[{'style':s,'durationSeconds':d} for s,d in zip(['electric','combustion'],durations)],'bytes':video.stat().st_size,'codec':'H.264 / AAC','resolution':'1920x1080','fps':60,'maxVolumeDb':float(re.search(r'max_volume: ([\-\d.]+) dB',audio.stderr)[1]),'meanVolumeDb':float(re.search(r'mean_volume: ([\-\d.]+) dB',audio.stderr)[1]),'source':'Actual game canvas and Web Audio, sequential electric then combustion segments','soundTracksMixed':False,'textOverlays':False,'hud':False,'cover':str(cover)}
assert info['meanVolumeDb']>-45 and info['maxVolumeDb']<0
(demo/'video-info.json').write_text(json.dumps(info,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(info,ensure_ascii=False,indent=2))
