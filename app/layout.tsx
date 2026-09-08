import type {Metadata,Viewport} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Stone Delivery Route',description:'每日配送、停一站和进度管理',manifest:'/manifest.webmanifest',icons:{icon:[{url:'/favicon-32.png',sizes:'32x32',type:'image/png'}],apple:[{url:'/apple-touch-icon.png',sizes:'180x180',type:'image/png'}]},appleWebApp:{capable:true,title:'Stone Delivery Route',statusBarStyle:'default'}};
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#191919'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>}
