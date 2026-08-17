/*!
 * e-RPH AI — Sistem Rancangan Pengajaran Harian Berbantukan AI
 * © 2026 Alimin bin Abu Bakar. Hak cipta terpelihara.
 * SK Belukar, Machang, Kelantan.
 * Penggunaan, pengedaran atau pengubahsuaian tanpa kebenaran bertulis adalah dilarang.
 */
/* ================= e-RPH AI — BOOT ================= */

auth.onAuthStateChanged(async user => {
  if(!user){ S.user = null; tunjuk('#authView'); return; }
  tunjuk('#boot'); $('#bootMsg').textContent = 'Menyemak akaun…';
  S.user = user;
  const emel = (user.email || '').toLowerCase();

  try{
    /* --- Profil pengguna --- */
    const ref = db.collection('pengguna').doc(emel);
    let doc = await ref.get();
    if(!doc.exists){
      await ref.set({
        emel, nama: user.displayName || emel.split('@')[0],
        peranan: EMEL_PEMILIK.includes(emel) ? 'pemilik' : 'guru',
        sekolahId: null, aktif: true, dibuat: Date.now()
      });
      doc = await ref.get();
    }
    S.profil = doc.data();

    /* Foto Google diambil sekali sahaja semasa log masuk. Jika guru memuat naik
       foto sendiri kemudian, pilihan itu dikekalkan dan tidak ditulis ganti. */
    if(!S.profil.foto && !S.profil.fotoSendiri && user.photoURL){
      const url = user.photoURL.replace(/=s\d+(-c)?$/, '=s256-c');
      await ref.set({ foto:url },{merge:true});
      S.profil.foto = url;
    }

    /* Naik taraf automatik untuk e-mel pemilik */
    if(EMEL_PEMILIK.includes(emel) && S.profil.peranan !== 'pemilik'){
      await ref.set({ peranan:'pemilik' },{merge:true});
      S.profil.peranan = 'pemilik';
    }
    S.peranan = S.profil.peranan || 'guru';

    if(S.profil.aktif === false){
      tunjuk('#authView');
      toast('Akaun anda dinyahaktifkan. Hubungi pentadbir.','salah');
      return auth.signOut();
    }

    /* --- Semakan langganan (pemilik dikecualikan) --- */
    if(S.peranan !== 'pemilik'){
      const st = statusLanggan(S.profil);
      if(st.jenis === 'tamat'){
        tunjuk('#authView');
        $('.auth-card').innerHTML = `
          <div class="brand" style="margin-bottom:14px">
            <div class="brand-mark"><img src="icons/icon-192.png" alt=""></div>
            <div><h1>Langganan tamat</h1><p>e-RPH AI</p></div>
          </div>
          <p style="font-size:14px;color:var(--teks-2);line-height:1.6">
            Langganan akaun <b>${esc(S.user.email)}</b> telah tamat pada <b>${esc(st.tarikh)}</b>.<br><br>
            Semua RPH dan data anda <b>kekal selamat</b>. Untuk terus menggunakan e-RPH AI,
            sila hubungi pentadbir sistem anda bagi melanjutkan langganan.</p>
          <button class="btn btn-block" style="margin-top:18px" onclick="firebase.auth().signOut().then(()=>location.reload())">Log keluar</button>`;
        return;
      }
      S.langganPeringatan = st.jenis === 'hampir' ? st : null;
    }

    /* --- Sekolah --- */
    S.sid = S.profil.sekolahId || null;
    if(S.sid){
      const sk = await db.collection('sekolah').doc(S.sid).get();
      S.sekolah = sk.exists ? { id:sk.id, ...sk.data() } : null;
      if(!S.sekolah){ S.sid = null; }
    }

    if(!S.sid){
      tunjuk('#app'); binaMenu(); papar();
      if(S.peranan === 'pemilik'){
        $('#kandungan').innerHTML = `<div class="kosong"><b>Belum ada sekolah</b>
          Cipta sekolah pertama anda untuk mula menggunakan e-RPH AI.<br><br>
          <button class="btn btn-primary" onclick="formSekolah()">+ Cipta sekolah</button></div>`;
        $('#tajukHal').textContent = 'Persediaan'; $('#subTajuk').textContent = 'Cipta sekolah';
      }else{
        $('#kandungan').innerHTML = `<div class="kosong"><b>Akaun belum dikaitkan dengan sekolah</b>
          Masukkan kod sekolah anda untuk menyertai.<br><br>
          <div style="max-width:280px;margin:0 auto">
            <input id="joinKod" placeholder="Kod sekolah" style="text-transform:uppercase;margin-bottom:10px">
            <button class="btn btn-primary btn-block" onclick="sertaiSekolah()">Sertai sekolah</button></div></div>`;
        $('#tajukHal').textContent = 'Persediaan'; $('#subTajuk').textContent = 'Sertai sekolah';
      }
      return;
    }

    $('#bootMsg').textContent = 'Memuatkan data sekolah…';
    await Promise.all([muatData(), muatAiAkaun()]);
    muatLogo();
    if(typeof pramuatGIS === 'function') pramuatGIS().catch(()=>{});   // sedia untuk butang Drive
    tunjuk('#app'); binaMenu(); papar(); pergi('dashboard');

  }catch(e){
    console.error(e);
    tunjuk('#app');
    $('#kandungan').innerHTML = `<div class="kosong"><b>Gagal memuatkan data</b>${esc(e.message||'')}
      <br><br><button class="btn" onclick="location.reload()">Cuba lagi</button></div>`;
  }
});

function papar(){
  $('#uNama').textContent = S.profil.nama || S.user.email;
  $('#uPeranan').textContent = S.peranan;
  segarAvatar();
  $('#sideSekolah').textContent = S.sekolah?.nama || 'Tiada sekolah';
}

async function sertaiSekolah(){
  const kod = $('#joinKod').value.trim().toUpperCase();
  if(!kod) return toast('Masukkan kod sekolah','salah');
  sibuk(true,'Menyemak kod…');
  const q = await db.collection('sekolah').where('kod','==',kod).limit(1).get();
  if(q.empty){ sibuk(false); return toast('Kod sekolah tidak dijumpai','salah'); }
  await db.collection('pengguna').doc(S.user.email).set({ sekolahId:q.docs[0].id },{merge:true});
  location.reload();
}

/* --- Service worker --- */
if('serviceWorker' in navigator){
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(()=>{}));
}
