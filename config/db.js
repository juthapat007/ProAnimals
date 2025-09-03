// config/db.js - แก้ไขให้รองรับทั้ง callback และ promise
import mysql from 'mysql2';

// สร้าง pool แบบ callback (สำหรับ server.js เดิม)
const poolWun = mysql.createPool({
  host: 'localhost',
  user: 'wun',
  password: '38659',
  database: 'hospital_animals',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const poolFei = mysql.createPool({
  host: 'localhost',
  user: 'fei',
  password: '123456',
  database: 'hospital_animals',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// สร้าง pool แบบ promise (สำหรับใช้กับ async/await)
const poolWunPromise = mysql.createPool({
  host: 'localhost',
  user: 'wun',
  password: '38659',
  database: 'hospital_animals',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
}).promise();

const poolFeiPromise = mysql.createPool({
  host: 'localhost',
  user: 'fei',  
  password: '123456',
  database: 'hospital_animals',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
}).promise();

// ฟังก์ชันเลือก pool แบบ callback
export function getPool(email) {
  if (email && email.endsWith('@wun.com')) return poolWun;
  return poolFei;
}

// ฟังก์ชันเลือก pool แบบ promise
export function getPoolPromise(email) {
  if (email && email.endsWith('@wun.com')) return poolWunPromise;
  return poolFeiPromise;
}