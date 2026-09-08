import type {Metadata,Viewport} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Stone Delivery Route',description:'每日配送、停一站和进度管理',manifest:'/manifest.webmanifest',appleWebApp:{capable:true,title:'Stone Delivery Route',statusBarStyle:'default'}};
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#191919'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>}
