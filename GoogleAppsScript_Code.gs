/**
 * GOOGLE APPS SCRIPT: RSVP & WISHES (UCAPAN)
 * Spreadsheet ID: 1NpKf9RHE87v7KO0lzEN0icO4xloqfh2dH9Cyvgvljg0
 * Sheet Name    : Sheet1
 * 
 * Kolom Spreadsheet:
 * 1. timestamp
 * 2. nama tamu
 * 3. ucapan
 * 4. konfirmasi kehadiran
 * 5. jumlah tamu
 * 
 * ====================================================================
 * PANDUAN DEPLOY SEBAGAI WEB APP:
 * 1. Buka spreadsheet Anda: https://docs.google.com/spreadsheets/d/1NpKf9RHE87v7KO0lzEN0icO4xloqfh2dH9Cyvgvljg0
 * 2. Di menu atas, klik Extensions (Ekstensi) > Apps Script.
 * 3. Hapus semua kode default di Apps Script, lalu paste seluruh isi file ini.
 * 4. Klik ikon Save (Simpan).
 * 5. Klik tombol "Deploy" (Terapkan) di kanan atas > "New deployment" (Penerapan baru).
 * 6. Klik ikon gerigi di samping "Select type" > pilih "Web app".
 * 7. Isi konfigurasi:
 *    - Description: RSVP & Wishes API
 *    - Execute as  : Me (email@anda.com)
 *    - Who has access: Anyone (Siapa saja)  <-- PENTING agar web bisa kirim & baca data
 * 8. Klik "Deploy", lalu berikan izin akses (Authorize access) akun Google Anda.
 * 9. Salin "Web app URL" (formatnya https://script.google.com/macros/s/.../exec).
 * 10. Masukkan URL tersebut ke variabel GAS_URL di index.html.
 * ====================================================================
 */

var SPREADSHEET_ID = "1NpKf9RHE87v7KO0lzEN0icO4xloqfh2dH9Cyvgvljg0";
var SHEET_NAME = "Sheet1";

/**
 * Handle POST request untuk menyimpan RSVP & Ucapan baru
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
    }
    
    // Inisialisasi header jika sheet masih kosong
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "timestamp",
        "nama tamu",
        "ucapan",
        "konfirmasi kehadiran",
        "jumlah tamu"
      ]);
      sheet.getRange(1, 1, 1, 5).setFontWeight("bold");
    }
    
    // Parse data dari request (bisa JSON string maupun parameter form)
    var data = {};
    if (e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (err) {
        data = e.parameter || {};
      }
    } else if (e.parameter) {
      data = e.parameter;
    }
    
    var namaTamu = data.nama_tamu || data.nama || data["nama tamu"] || "Tamu";
    var ucapan = data.ucapan || data.wishes || data.pesan || "-";
    var konfirmasi = data.konfirmasi_kehadiran || data.konfirmasi || data["konfirmasi kehadiran"] || data.attendance || "Excited to Attend";
    var jumlahTamu = data.jumlah_tamu || data.jumlah || data["jumlah tamu"] || data.guests || "1";
    
    // Format timestamp Indonesia (WIB)
    var timestamp = Utilities.formatDate(new Date(), "Asia/Jakarta", "dd/MM/yyyy HH:mm:ss");
    
    // Simpan ke baris baru
    sheet.appendRow([
      timestamp,
      namaTamu,
      ucapan,
      konfirmasi,
      jumlahTamu
    ]);
    
    var responseOutput = {
      status: "success",
      message: "Ucapan & RSVP berhasil disimpan",
      data: {
        timestamp: timestamp,
        nama_tamu: namaTamu,
        ucapan: ucapan,
        konfirmasi_kehadiran: konfirmasi,
        jumlah_tamu: jumlahTamu
      }
    };
    
    return ContentService
      .createTextOutput(JSON.stringify(responseOutput))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        status: "error",
        message: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Handle GET request untuk mengambil daftar ucapan wishes & RSVP
 * Mendukung query parameter:
 * - action=read (default)
 * - callback (untuk JSONP jika diperlukan)
 */
function doGet(e) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet || sheet.getLastRow() <= 1) {
      var emptyResult = { status: "success", total: 0, data: [] };
      return formatOutput(emptyResult, e);
    }
    
    var values = sheet.getDataRange().getValues();
    // Baris pertama adalah header
    var resultData = [];
    
    for (var i = 1; i < values.length; i++) {
      var row = values[i];
      if (!row[1] && !row[2]) continue; // Lewati jika nama dan ucapan kosong
      
      resultData.push({
        timestamp: row[0] ? row[0].toString() : "",
        nama_tamu: row[1] ? row[1].toString() : "Anonim",
        ucapan: row[2] ? row[2].toString() : "",
        konfirmasi_kehadiran: row[3] ? row[3].toString() : "Excited to Attend",
        jumlah_tamu: row[4] ? row[4].toString() : "1"
      });
    }
    
    // Urutkan dari yang terbaru (newest first)
    resultData.reverse();
    
    var output = {
      status: "success",
      total: resultData.length,
      data: resultData
    };
    
    return formatOutput(output, e);
    
  } catch (error) {
    var errOutput = {
      status: "error",
      message: error.toString(),
      data: []
    };
    return formatOutput(errOutput, e);
  }
}

function formatOutput(dataObj, e) {
  var jsonString = JSON.stringify(dataObj);
  var callback = e && e.parameter && e.parameter.callback;
  
  if (callback) {
    return ContentService
      .createTextOutput(callback + "(" + jsonString + ")")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  
  return ContentService
    .createTextOutput(jsonString)
    .setMimeType(ContentService.MimeType.JSON);
}
