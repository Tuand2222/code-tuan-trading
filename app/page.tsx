"use client";
import {useEffect} from 'react';
export default function Home(){
 useEffect(()=>{window.location.replace('/v6/'+window.location.search+window.location.hash);},[]);
 return <main><h1>Trading Plan Pro</h1><p>Đang mở nhật ký giao dịch…</p><a href="/v6/">Mở ứng dụng</a></main>;
}
