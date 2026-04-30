/*

   Author: @SakanaaDesu
   Saluran: https://whatsapp.com/channel/0029Vb7Q3tA0bIdwP0cpwA3J

*/

import axios from "axios";

export const info = {
  name: "Biodata Karakter Anime",

  menu: ["charinfo"],
  case: ["biodata", "biowaifu", "charinfo", "biochar", "biokarakter", "infochar"],

  description: "Cari biodata karakter anime",
  hidden: false,

  owner: false,
  premium: false,
  group: false,
  private: false,
  admin: false,
  botAdmin: false,

  allowPrivate: true,
};

async function translateToID(text) {
  try {
    const res = await axios.get("https://api.mymemory.translated.net/get", {
      params: {
        q: text,
        langpair: "en|id",
        de: "emailkamu@gmail.com", // Note: Ganti Dengan Email Mu
      },
    });
    return res.data?.responseData?.translatedText || text;
  } catch {
    return text;
  }
}

const ANILIST_URL = "https://graphql.anilist.co";

const charFields = `
  id
  name { full native }
  age
  gender
  bloodType
  dateOfBirth { month day year }
  description(asHtml: false)
  image { large }
`;

const queryDirect = `
  query ($search: String) {
    Character(search: $search) { ${charFields} }
  }
`;

const queryPage = `
  query ($search: String) {
    Page(page: 1, perPage: 1) {
      characters(search: $search) { ${charFields} }
    }
  }
`;

async function findCharacter(search) {
  const { data: d1 } = await axios.post(ANILIST_URL, {
    query: queryDirect,
    variables: { search },
  });
  if (d1?.data?.Character) return d1.data.Character;

  const { data: d2 } = await axios.post(ANILIST_URL, {
    query: queryPage,
    variables: { search },
  });
  return d2?.data?.Page?.characters?.[0] || null;
}

export default async function handler(leni) {
  const {
    q,
    lenwyreply,
    LenwyText,
    LenwyWait,
    LenwyImage,
  } = leni;

  if (!q)
    return lenwyreply(
      "⚠️ *Masukkan Nama Karakter Animenya!*\n\n" +
        "Contoh: *.charinfo Yui Hirasawa*"
    );

  await LenwyWait();

  try {
    const char = await findCharacter(q);

    if (!char)
      return lenwyreply(
        "⚠️ *Karakter tidak ditemukan!*\n\nCoba cek ejaan nama-nya ya."
      );

    const imgUrl = char.image?.large || null;

    let bio = char.description || "Tidak ada biografi tersedia.";
    if (bio.length > 2000) {
      const potong = bio.lastIndexOf(".", 2000);
      bio = potong !== -1 ? bio.slice(0, potong + 1) : bio.slice(0, 2000);
    }
    const bioID = await translateToID(bio);

    const namaBulan = [
      "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember",
    ];
    const dob = char.dateOfBirth;
    const tglLahir =
      dob?.month && dob?.day
        ? `${dob.day} ${namaBulan[dob.month]}${dob.year ? " " + dob.year : ""}`
        : "Tidak diketahui";

    const caption =
      `*Profil ${char.name.full}*\n` +
      `\n` +
      `*ID AniList:* ${char.id}\n` +
      `*Nama:* ${char.name.full}\n` +
      `*Native:* ${char.name.native || "?"}\n\n` +
      `*Ultah:* ${tglLahir}\n` +
      `*Gol. Darah:* ${char.bloodType || "?"}\n` +
      `*Gender:* ${char.gender || "?"}\n` +
      `\n\n` +
      `*Bio:*\n${bioID}\n\n` +
      `_Sumber: AniList.co_`;

    if (imgUrl) {
      await LenwyImage(imgUrl, caption);
    } else {
      await LenwyText(caption);
    }
  } catch (err) {
    return lenwyreply(`*Karakter Gak Ketemu Nih! Coba Pastikan Ejaan Namanya Bener*`);
  }
}
