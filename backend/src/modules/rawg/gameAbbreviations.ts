/**
 * Abbreviations players actually type, mapped to the title RAWG knows.
 * RAWG's search can't connect "ds3" to Dark Souls III on its own (it returns
 * unrelated titles containing "DS 3"), so these are expanded before searching.
 * Keys are normalised: lowercase, no spaces or punctuation.
 */
const ABBREVIATIONS: Record<string, string> = {
  ds1: "Dark Souls", ds2: "Dark Souls II", ds3: "Dark Souls III", dsr: "Dark Souls: Remastered",
  er: "Elden Ring", sekiro: "Sekiro: Shadows Die Twice", bb: "Bloodborne",
  botw: "The Legend of Zelda: Breath of the Wild", totk: "The Legend of Zelda: Tears of the Kingdom",
  rdr: "Red Dead Redemption", rdr1: "Red Dead Redemption", rdr2: "Red Dead Redemption 2",
  gta3: "Grand Theft Auto III", gtavc: "Grand Theft Auto: Vice City", gtasa: "Grand Theft Auto: San Andreas",
  gta4: "Grand Theft Auto IV", gtaiv: "Grand Theft Auto IV", gta5: "Grand Theft Auto V", gtav: "Grand Theft Auto V",
  tw3: "The Witcher 3: Wild Hunt", witcher3: "The Witcher 3: Wild Hunt",
  cp2077: "Cyberpunk 2077", cyberpunk: "Cyberpunk 2077",
  bg3: "Baldur's Gate 3", bg2: "Baldur's Gate II: Enhanced Edition",
  ff7: "Final Fantasy VII", ff7r: "Final Fantasy VII Remake", ff10: "Final Fantasy X", ff14: "Final Fantasy XIV Online",
  ff15: "Final Fantasy XV", ff16: "Final Fantasy XVI",
  mgs: "Metal Gear Solid", mgs3: "Metal Gear Solid 3: Snake Eater", mgs5: "Metal Gear Solid V: The Phantom Pain",
  mgsv: "Metal Gear Solid V: The Phantom Pain",
  re2: "Resident Evil 2", re4: "Resident Evil 4", re7: "Resident Evil 7: Biohazard", re8: "Resident Evil Village",
  codmw: "Call of Duty: Modern Warfare", codmw2: "Call of Duty: Modern Warfare 2", codmw3: "Call of Duty: Modern Warfare 3",
  codbo: "Call of Duty: Black Ops", codbo2: "Call of Duty: Black Ops II", codbo3: "Call of Duty: Black Ops III",
  csgo: "Counter-Strike: Global Offensive", cs2: "Counter-Strike 2",
  lol: "League of Legends", dota2: "Dota 2", wow: "World of Warcraft", ow2: "Overwatch 2", ow: "Overwatch",
  pubg: "PUBG: BATTLEGROUNDS", r6: "Tom Clancy's Rainbow Six Siege", r6s: "Tom Clancy's Rainbow Six Siege",
  hk: "Hollow Knight", hkss: "Hollow Knight: Silksong", silksong: "Hollow Knight: Silksong",
  sdv: "Stardew Valley", acnh: "Animal Crossing: New Horizons",
  ac2: "Assassin's Creed II", acbf: "Assassin's Creed IV: Black Flag", acv: "Assassin's Creed Valhalla",
  ac4: "Assassin's Creed IV: Black Flag", acodyssey: "Assassin's Creed Odyssey", acorigins: "Assassin's Creed Origins",
  me1: "Mass Effect", me2: "Mass Effect 2", me3: "Mass Effect 3", mele: "Mass Effect Legendary Edition",
  hl2: "Half-Life 2", hl: "Half-Life", l4d2: "Left 4 Dead 2", tf2: "Team Fortress 2",
  nms: "No Man's Sky", kcd: "Kingdom Come: Deliverance", kcd2: "Kingdom Come: Deliverance II",
  p5: "Persona 5", p5r: "Persona 5 Royal", p3r: "Persona 3 Reload", p4g: "Persona 4 Golden",
  mhw: "Monster Hunter: World", mhr: "Monster Hunter Rise", mhwilds: "Monster Hunter Wilds",
  gow: "God of War", gowr: "God of War Ragnarök", tlou: "The Last of Us Part I", tlou2: "The Last of Us Part II",
  dmc5: "Devil May Cry 5", dbd: "Dead by Daylight", ror2: "Risk of Rain 2", poe: "Path of Exile", poe2: "Path of Exile 2",
  bl2: "Borderlands 2", bl3: "Borderlands 3", fo3: "Fallout 3", fo4: "Fallout 4", fnv: "Fallout: New Vegas",
  tes5: "The Elder Scrolls V: Skyrim", eso: "The Elder Scrolls Online",
};

const compact = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "");

/** The full title for a known abbreviation ("rdr 2" -> "Red Dead Redemption 2"), or null. */
export function expandAbbreviation(query: string): string | null {
  return ABBREVIATIONS[compact(query)] ?? null;
}
