// Firebase 專案設定，index.html / admin.html / pos.html 共用。
// 這些值本來就是設計成可以公開放在前端的（Firebase 的安全性是靠
// Realtime Database / Storage 的安全規則，不是靠隱藏這組設定），
// 拆成獨立檔案純粹是為了讓別人複製這套架構時，只需要換這一個檔案
// 就能接上自己的 Firebase 專案，不用去改三個 HTML 檔案裡的程式碼。
const FB_CONFIG = {
  apiKey: 'AIzaSyBa7puZRH8Aopj2_Qf2X7zsDg-LON4ZsBw',
  authDomain: 'whitedessert.firebaseapp.com',
  databaseURL: 'https://whitedessert-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'whitedessert',
};
