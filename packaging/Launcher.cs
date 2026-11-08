using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Diagnostics;
using System.Collections.Generic;
using System.Windows.Forms;

// A loopback-only static server. Uses the .NET Framework shipped with Windows;
// the distributed game does not require Node.js or a development server.
internal static class Launcher {
 static string root;
 static long heartbeat=DateTime.UtcNow.Ticks;
 static bool serverOnly;
 static TcpListener listener;
 static readonly Dictionary<string,string> mime=new Dictionary<string,string>(StringComparer.OrdinalIgnoreCase){
  {".html","text/html; charset=utf-8"},{".js","application/javascript; charset=utf-8"},{".css","text/css; charset=utf-8"},{".json","application/json; charset=utf-8"},{".jpg","image/jpeg"},{".jpeg","image/jpeg"},{".png","image/png"},{".svg","image/svg+xml"},{".hdr","application/octet-stream"},{".ico","image/x-icon"},{".woff2","font/woff2"},{".mp3","audio/mpeg"},{".ogg","audio/ogg"}
 };
 [STAThread] static void Main(string[] args){
  try {
   root=Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"dist"))+Path.DirectorySeparatorChar;
   if(!File.Exists(Path.Combine(root,"index.html")))throw new Exception("Please keep the dist folder next to this launcher. 请将启动器与 dist 文件夹放在一起。");
   serverOnly=Array.IndexOf(args,"--server-only")>=0;
   int port=0;for(int i=0;i<args.Length-1;i++)if(args[i]=="--port")port=int.Parse(args[i+1]);
   listener=new TcpListener(IPAddress.Loopback,port);listener.Start();port=((IPEndPoint)listener.LocalEndpoint).Port;
   string url="http://127.0.0.1:"+port+"/";
   File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"last-launch.json"),"{\"url\":\""+url+"\",\"pid\":"+Process.GetCurrentProcess().Id+"}");
   if(!serverOnly){
    string chrome=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"Google","Chrome","Application","chrome.exe");
    string edge=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),"Microsoft","Edge","Application","msedge.exe");
    if(File.Exists(chrome))Process.Start(new ProcessStartInfo(chrome,"--app="+url+" --window-size=1920,1080"){UseShellExecute=true});
    else if(File.Exists(edge))Process.Start(new ProcessStartInfo(edge,"--app="+url+" --window-size=1920,1080"){UseShellExecute=true});
    else Process.Start(new ProcessStartInfo(url){UseShellExecute=true});
   }
   var idle=new System.Threading.Timer(delegate {if(!serverOnly && new TimeSpan(DateTime.UtcNow.Ticks-Interlocked.Read(ref heartbeat)).TotalSeconds>90){listener.Stop();Environment.Exit(0);}},null,30000,15000);
   while(true){TcpClient client=listener.AcceptTcpClient();ThreadPool.QueueUserWorkItem(delegate{Serve(client);});}
  }catch(Exception ex){if(!serverOnly)MessageBox.Show(ex.Message,"AFTER RAIN · 启动提示",MessageBoxButtons.OK,MessageBoxIcon.Information);}
 }
 static void Serve(TcpClient client){
  try {using(client){client.ReceiveTimeout=4000;client.SendTimeout=10000;using(NetworkStream stream=client.GetStream()){
   var line=new StringBuilder();int current;int total=0;string tail="";
   while((current=stream.ReadByte())!=-1){if(++total>16384)return;line.Append((char)current);tail=(tail+(char)current);if(tail.Length>4)tail=tail.Substring(tail.Length-4);if(tail=="\r\n\r\n")break;}
   string[] request=line.ToString().Split(new string[]{"\r\n"},StringSplitOptions.None)[0].Split(' ');if(request.Length<2)return;
   string target=request[1].Split('?')[0];
   if(target=="/__heartbeat"||target=="/__health"){Interlocked.Exchange(ref heartbeat,DateTime.UtcNow.Ticks);Send(stream,200,"application/json",Encoding.UTF8.GetBytes("{\"ok\":true,\"app\":\"after-rain\"}"),false);return;}
   if(request[0]!="GET"&&request[0]!="HEAD"){Send(stream,405,"text/plain",Encoding.UTF8.GetBytes("Method not allowed"),false);return;}
   string relative=Uri.UnescapeDataString(target).TrimStart('/').Replace('/',Path.DirectorySeparatorChar);if(relative.Length==0)relative="index.html";
   string file=Path.GetFullPath(Path.Combine(root,relative));
   if(!file.StartsWith(root,StringComparison.OrdinalIgnoreCase)||!File.Exists(file)){Send(stream,404,"text/plain",Encoding.UTF8.GetBytes("Not found"),false);return;}
   string contentType; if(!mime.TryGetValue(Path.GetExtension(file),out contentType))contentType="application/octet-stream";
   byte[] bytes=File.ReadAllBytes(file);Send(stream,200,contentType,bytes,request[0]=="HEAD");
  }}}catch(IOException){}catch(SocketException){}catch(Exception){}
 }
 static void Send(Stream s,int code,string type,byte[] body,bool head){string header="HTTP/1.1 "+code+" "+(code==200?"OK":"Error")+"\r\nContent-Type: "+type+"\r\nContent-Length: "+body.Length+"\r\nConnection: close\r\nCache-Control: no-cache\r\nX-Content-Type-Options: nosniff\r\n\r\n";byte[] h=Encoding.ASCII.GetBytes(header);s.Write(h,0,h.Length);if(!head)s.Write(body,0,body.Length);s.Flush();}
}
