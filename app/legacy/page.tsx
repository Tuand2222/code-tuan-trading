"use client";
import { useEffect } from 'react';
export default function Legacy() {
  useEffect(() => { window.location.replace('/v6/#settings'); }, []);
  return <main><h1>Trading Plan Pro</h1><p>Đã gộp về một ứng dụng. Mở Cài đặt để đọc và gộp dữ liệu web cũ trên thiết bị.</p><a href="/v6/#settings">Mở ứng dụng và khôi phục dữ liệu</a></main>;
}
