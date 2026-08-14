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
    await muatData();
    muatLogo();
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
  $('#avUser').textContent = (S.profil.nama || S.user.email)[0].toUpperCase();
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
