/* ==========================================================================
   SZOLGÁLTATÁSOK & ÁRAK  –  this is the only file you need to edit
   to update the price list.

   Category fields:
     name     – tab label (required)
     intro    – short text shown above the list (optional)
     note     – small text shown under the list (optional)
     compact  – true = simple "name … price" rows (good for long lists
                like waxing), with one booking button for the category
     items    – the treatments

   Item fields (only `name` is required):
     name, desc, duration, price, tag (a small label like "Kedvenc")

   If `categories` is empty, the site shows an "árlista hamarosan" card.
   ========================================================================== */

window.ESSZENCIA_SERVICES = {
  // Shown above the tabs (leave "" to hide)
  intro: "Magister professzionális termékekkel – a természet erejével a szép és egészséges bőrért.",
  // Shown under the list (leave "" to hide)
  note: "Az árak forintban értendők.",

  categories: [
    {
      name: "Arctisztító nagykezelések",
      intro: "Letisztítás, bőrradír, felpuhítás gőzzel vagy borogatással, pórustisztítás, fertőtlenítés, pórusösszehúzó-nyugtató pakolás, arcmasszázs, befejező krém vagy szérum.",
      items: [
        { name: "Alap nagykezelés – arc", duration: "~60 perc", price: "10 500 Ft" },
        { name: "Alap nagykezelés – arc + dekoltázs", duration: "~75 perc", price: "13 500 Ft" },
        // TODO: confirm price – the printed price list shows 9 500 Ft here, which looks like a typo
        { name: "Alap nagykezelés – arc + dekoltázs + gépi hatóanyagbevitel", duration: "~90 perc", price: "Érdeklődj" }
      ]
    },
    {
      name: "Kiskezelések",
      intro: "Letisztítás, tonizálás, bőrradír, arc-, nyak- és dekoltázsmasszázs, bőrfeltöltő, tápláló fitokozmetikumokkal; gépi kezelés – szérumok, boosterek bejuttatása a bőr mélyebb rétegeibe –, szemkörnyékápolás, befejező krém.",
      items: [
        { name: "Alap kiskezelés – arc", duration: "~60 perc", price: "9 500 Ft" },
        { name: "Alap kiskezelés – arc + dekoltázs", duration: "~75 perc", price: "12 500 Ft" },
        { name: "Alap kiskezelés – arc + dekoltázs + gépi hatóanyagbevitel", duration: "~90 perc", price: "14 500 Ft" }
      ]
    },
    {
      name: "Fasciális arcterápia",
      intro: "Holisztikus, mélyszöveti (kötőszöveti) terápia. A kötőszöveti letapadások oldásával nemcsak az arcra, hanem a test teljes fasciahálójára, a nyirok- és vérkeringésre, valamint közvetlenül az idegrendszerre is hat. A vagus ideg stimulálásával lekapcsolja a stresszért felelős szimpatikus idegrendszert, és aktiválja a szervezet öngyógyító, paraszimpatikus állapotát. A mély idegrendszeri és testi ellazulás látványos „mellékhatása” a természetes lifting-hatás, az állkapocstáji stressz oldódása, a ragyogó bőrkép és a feszültségmentes, kisimult arcvonások.",
      items: [
        { name: "Fasciális arcterápia", duration: "60 perc", price: "13 500 Ft" },
        { name: "Fasciális arcterápia + arcszobrász masszázs", desc: "Feszesítő fitokozmetikumokkal.", duration: "90 perc", price: "15 600 Ft" },
        { name: "Flow & Relax spa kezelés", desc: "Illóolajos, tengerisós lábfürdő, talp aromaolajos bedörzsölése, hát és váll kimozgatása, fasciális arcterápia, arcszobrász masszázs hatóanyag-bevitellel, feszesítő arcmaszk, craniosacralis terápia.", duration: "~180 perc", price: "18 000 Ft", tag: "Teljes kikapcsolódás" }
      ]
    },
    {
      name: "Masszázsok",
      items: [
        { name: "Relaxáló arc- és dekoltázsmasszázs", desc: "Hatóanyagokkal és peelinggel.", duration: "45 / 60 perc", price: "7 500 / 9 000 Ft" },
        { name: "Indiai stresszoldó fej- és nyakmasszázs", duration: "30 perc", price: "6 000 Ft" },
        { name: "Talp- és lábmasszázs", duration: "30 perc", price: "6 000 Ft" },
        { name: "Relaxáló hátmasszázs", duration: "30 perc", price: "6 000 Ft" }
      ]
    },
    {
      name: "Gyanták – nőknek",
      compact: true,
      note: "Teljes láb + bikini, illetve teljes láb + bikini + hónalj: kedvezményes áron!",
      items: [
        { name: "Bajusz / áll / pajesz / szemöldök", price: "1 500 Ft" },
        { name: "Bajusz + áll + pajesz", price: "3 500 Ft" },
        { name: "Térdig", price: "3 000 Ft" },
        { name: "Teljes láb", price: "5 000 Ft" },
        { name: "Bikini", price: "2 000 – 2 800 Ft" },
        { name: "Intim (brazil)", price: "3 500 – 4 000 Ft" },
        { name: "Intim (popsival)", price: "4 200 – 4 500 Ft" },
        { name: "Hónalj", price: "1 500 – 2 000 Ft" },
        { name: "Kar – alkar / teljes kar", price: "2 000 – 2 500 Ft" },
        { name: "Hát", price: "3 800 Ft" },
        { name: "Has", price: "2 000 Ft" }
      ]
    },
    {
      name: "Gyanták – férfiaknak",
      compact: true,
      items: [
        { name: "Szemöldök", price: "1 500 Ft" },
        { name: "Mellkas + has", price: "4 000 – 4 500 Ft" },
        { name: "Hát + váll", price: "4 000 – 5 000 Ft" },
        { name: "Láb végig", price: "5 500 Ft" },
        { name: "Láb térdig", price: "3 500 Ft" },
        { name: "Kar (alkar + felkar)", price: "3 000 Ft" }
      ]
    },
    {
      name: "Festések",
      intro: "Refectocil és Orenna professzionális festékekkel.",
      compact: true,
      items: [
        { name: "Szempillafestés", price: "2 500 Ft" },
        { name: "Szemöldökfestés", price: "2 500 Ft" },
        { name: "Szempilla- + szemöldökfestés (szedéssel)", price: "4 800 Ft" },
        { name: "Szemöldökszedés, igazítás", price: "1 500 Ft" },
        { name: "Szempilla- + szemöldökfestés bármelyik arckezelés mellé", price: "3 800 Ft" }
      ]
    }
  ]
};
