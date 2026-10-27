/* ==========================================================================
   SZOLGÁLTATÁSOK & ÁRAK  –  this is the only file you need to edit
   to update the price list.

   Every text can be written two ways:
     name: "Szemöldökfestés"                                  ← Hungarian only
     name: { hu: "Szemöldökfestés", en: "Brow tint",
             de: "Augenbrauen färben", sv: "Färgning av bryn" } ← 4 languages
   A missing language falls back to Hungarian.

   Category fields:
     name     – tab label (required)
     intro    – short text shown above the list (optional)
     note     – small text shown under the list (optional)
     compact  – true = simple "name … price" rows (good for long lists
                like waxing), with one booking button for the category
     items    – the treatments

   Item fields (only `name` is required):
     name, desc, duration ("~60 perc" – "perc" is translated automatically),
     price ("10 500 Ft", or "Érdeklődj" = on request), tag (small label)

   If `categories` is empty, the site shows an "árlista hamarosan" card.
   ========================================================================== */

window.ESSZENCIA_SERVICES = {
  intro: {
    hu: "Magister professzionális termékekkel – a természet erejével a szép és egészséges bőrért.",
    en: "With Magister professional products – the power of nature for beautiful, healthy skin.",
    de: "Mit professionellen Magister-Produkten – die Kraft der Natur für schöne, gesunde Haut.",
    sv: "Med professionella produkter från Magister – naturens kraft för vacker, frisk hud."
  },
  note: {
    hu: "Az árak forintban értendők.",
    en: "Prices are in Hungarian forints (HUF).",
    de: "Preise in ungarischen Forint (HUF).",
    sv: "Priserna anges i ungerska forint (HUF)."
  },

  categories: [
    {
      name: { hu: "Arctisztító nagykezelések", en: "Deep-cleansing facials", de: "Tiefenreinigende Gesichtsbehandlungen", sv: "Djuprengörande ansiktsbehandlingar" },
      intro: {
        hu: "Letisztítás, bőrradír, felpuhítás gőzzel vagy borogatással, pórustisztítás, fertőtlenítés, pórusösszehúzó-nyugtató pakolás, arcmasszázs, befejező krém vagy szérum.",
        en: "Cleansing, scrub, softening with steam or compresses, pore cleansing, disinfection, pore-tightening soothing mask, facial massage, finishing cream or serum.",
        de: "Reinigung, Peeling, Erweichen mit Dampf oder Kompressen, Porenreinigung, Desinfektion, porenverfeinernde beruhigende Maske, Gesichtsmassage, Abschlusscreme oder Serum.",
        sv: "Rengöring, skrubb, uppmjukning med ånga eller kompresser, porrengöring, desinficering, porsammandragande lugnande mask, ansiktsmassage, avslutande kräm eller serum."
      },
      items: [
        { name: { hu: "Alap nagykezelés – arc", en: "Deep-cleansing facial – face", de: "Tiefenreinigung – Gesicht", sv: "Djuprengöring – ansikte" }, duration: "~60 perc", price: "10 500 Ft" },
        { name: { hu: "Alap nagykezelés – arc + dekoltázs", en: "Deep-cleansing facial – face + décolleté", de: "Tiefenreinigung – Gesicht + Dekolleté", sv: "Djuprengöring – ansikte + dekolletage" }, duration: "~75 perc", price: "12 500 Ft" },
        { name: { hu: "Alap nagykezelés – arc + dekoltázs + gépi hatóanyagbevitel", en: "Deep-cleansing facial – face + décolleté + device-assisted infusion", de: "Tiefenreinigung – Gesicht + Dekolleté + apparative Wirkstoffeinschleusung", sv: "Djuprengöring – ansikte + dekolletage + maskinell inslussning" }, duration: "~90 perc", price: "14 500 Ft" }
      ]
    },
    {
      name: { hu: "Kiskezelések", en: "Care facials", de: "Pflegebehandlungen", sv: "Vårdande ansiktsbehandlingar" },
      intro: {
        hu: "Letisztítás, tonizálás, bőrradír, arc-, nyak- és dekoltázsmasszázs, bőrfeltöltő, tápláló fitokozmetikumokkal; gépi kezelés – szérumok, boosterek bejuttatása a bőr mélyebb rétegeibe –, szemkörnyékápolás, befejező krém.",
        en: "Cleansing, toning, scrub, face, neck and décolleté massage with plumping, nourishing phyto-cosmetics; device treatment – infusing serums and boosters into the deeper layers of the skin –, eye-area care, finishing cream.",
        de: "Reinigung, Tonisieren, Peeling, Gesichts-, Hals- und Dekolletémassage mit aufpolsternder, nährender Phytokosmetik; apparative Behandlung – Einschleusen von Seren und Boostern in tiefere Hautschichten –, Augenpflege, Abschlusscreme.",
        sv: "Rengöring, toning, skrubb, massage av ansikte, hals och dekolletage med återfuktande, närande fytokosmetika; maskinell behandling – serum och boosters förs in i hudens djupare lager –, ögonvård, avslutande kräm."
      },
      items: [
        { name: { hu: "Alap kiskezelés – arc", en: "Care facial – face", de: "Pflegebehandlung – Gesicht", sv: "Vårdande behandling – ansikte" }, duration: "~60 perc", price: "9 500 Ft" },
        { name: { hu: "Alap kiskezelés – arc + dekoltázs", en: "Care facial – face + décolleté", de: "Pflegebehandlung – Gesicht + Dekolleté", sv: "Vårdande behandling – ansikte + dekolletage" }, duration: "~75 perc", price: "12 500 Ft" },
        { name: { hu: "Alap kiskezelés – arc + dekoltázs + gépi hatóanyagbevitel", en: "Care facial – face + décolleté + device-assisted infusion", de: "Pflegebehandlung – Gesicht + Dekolleté + apparative Wirkstoffeinschleusung", sv: "Vårdande behandling – ansikte + dekolletage + maskinell inslussning" }, duration: "~90 perc", price: "14 500 Ft" }
      ]
    },
    {
      name: { hu: "Fasciális arcterápia", en: "Fascial facial therapy", de: "Fasziale Gesichtstherapie", sv: "Fascial ansiktsterapi" },
      intro: {
        hu: "Holisztikus, mélyszöveti (kötőszöveti) terápia. A kötőszöveti letapadások oldásával nemcsak az arcra, hanem a test teljes fasciahálójára, a nyirok- és vérkeringésre, valamint közvetlenül az idegrendszerre is hat. A vagus ideg stimulálásával lekapcsolja a stresszért felelős szimpatikus idegrendszert, és aktiválja a szervezet öngyógyító, paraszimpatikus állapotát. A mély idegrendszeri és testi ellazulás látványos „mellékhatása” a természetes lifting-hatás, az állkapocstáji stressz oldódása, a ragyogó bőrkép és a feszültségmentes, kisimult arcvonások.",
        en: "A holistic deep-tissue (connective tissue) therapy. By releasing fascial adhesions it works not only on the face but on the body's entire fascial network, on lymph and blood circulation, and directly on the nervous system. Stimulating the vagus nerve switches off the stress-driven sympathetic nervous system and activates the body's self-healing, parasympathetic state. The visible “side effects” of this deep physical and nervous relaxation: a natural lifting effect, released jaw tension, a radiant complexion and relaxed, smooth facial features.",
        de: "Eine ganzheitliche Tiefengewebs- (Bindegewebs-)Therapie. Durch das Lösen von Verklebungen im Bindegewebe wirkt sie nicht nur auf das Gesicht, sondern auf das gesamte Fasziennetz des Körpers, auf Lymph- und Blutkreislauf und direkt auf das Nervensystem. Die Stimulation des Vagusnervs schaltet das stressgesteuerte sympathische Nervensystem ab und aktiviert den selbstheilenden, parasympathischen Zustand. Die sichtbaren „Nebenwirkungen“ der tiefen Entspannung: ein natürlicher Lifting-Effekt, gelöste Kieferspannung, ein strahlendes Hautbild und entspannte, glatte Gesichtszüge.",
        sv: "En holistisk djupvävnads- (bindvävs-)terapi. Genom att lösa upp sammanväxningar i bindväven verkar den inte bara på ansiktet utan på kroppens hela fasciasystem, på lymf- och blodcirkulationen och direkt på nervsystemet. Stimulering av vagusnerven stänger av det stressdrivna sympatiska nervsystemet och aktiverar kroppens självläkande, parasympatiska läge. De synliga ”bieffekterna” av den djupa avslappningen: en naturlig lyfteffekt, släppta spänningar i käken, en strålande hy och avslappnade, släta anletsdrag."
      },
      items: [
        { name: { hu: "Fasciális arcterápia", en: "Fascial facial therapy", de: "Fasziale Gesichtstherapie", sv: "Fascial ansiktsterapi" }, duration: "60 perc", price: "13 500 Ft" },
        { name: { hu: "Fasciális arcterápia + arcszobrász masszázs", en: "Fascial facial therapy + face-sculpting massage", de: "Fasziale Gesichtstherapie + Face-Sculpting-Massage", sv: "Fascial ansiktsterapi + ansiktsskulpterande massage" },
          desc: { hu: "Feszesítő fitokozmetikumokkal.", en: "With firming phyto-cosmetics.", de: "Mit straffender Phytokosmetik.", sv: "Med uppstramande fytokosmetika." },
          duration: "90 perc", price: "15 600 Ft" },
        { name: { hu: "Flow & Relax spa kezelés", en: "Flow & Relax spa treatment", de: "Flow & Relax Spa-Behandlung", sv: "Flow & Relax spabehandling" },
          desc: {
            hu: "Illóolajos, tengerisós lábfürdő, talp aromaolajos bedörzsölése, hát és váll kimozgatása, fasciális arcterápia, arcszobrász masszázs hatóanyag-bevitellel, feszesítő arcmaszk, craniosacralis terápia.",
            en: "Sea-salt foot bath with essential oils, aromatic oil rub for the soles, back and shoulder mobilisation, fascial facial therapy, face-sculpting massage with active-ingredient infusion, firming face mask, craniosacral therapy.",
            de: "Fußbad mit Meersalz und ätherischen Ölen, Einreibung der Fußsohlen mit Aromaöl, Mobilisation von Rücken und Schultern, fasziale Gesichtstherapie, Face-Sculpting-Massage mit Wirkstoffeinschleusung, straffende Gesichtsmaske, Craniosacral-Therapie.",
            sv: "Fotbad med havssalt och eteriska oljor, aromaoljemassage av fotsulorna, mobilisering av rygg och axlar, fascial ansiktsterapi, ansiktsskulpterande massage med aktiva ämnen, uppstramande ansiktsmask, kraniosakral terapi."
          },
          duration: { hu: "~2,5–3 óra", en: "~2.5–3 hours", de: "~2,5–3 Std.", sv: "~2,5–3 tim" }, minutes: 180, price: "19 000 Ft",
          tag: { hu: "Teljes kikapcsolódás", en: "Total unwind", de: "Pure Entspannung", sv: "Total avkoppling" } }
      ]
    },
    {
      name: { hu: "Masszázsok", en: "Massages", de: "Massagen", sv: "Massage" },
      items: [
        { name: { hu: "Relaxáló arc- és dekoltázsmasszázs", en: "Relaxing face & décolleté massage", de: "Entspannende Gesichts- & Dekolletémassage", sv: "Avslappnande ansikts- och dekolletagemassage" },
          desc: { hu: "Hatóanyagokkal és peelinggel.", en: "With active ingredients and a peel.", de: "Mit Wirkstoffen und Peeling.", sv: "Med aktiva ämnen och peeling." },
          duration: "45 / 60 perc", price: "7 500 / 9 000 Ft" },
        { name: { hu: "Indiai stresszoldó fej- és nyakmasszázs", en: "Indian stress-relief head & neck massage", de: "Indische Anti-Stress-Kopf- und Nackenmassage", sv: "Indisk stressavlastande huvud- och nackmassage" }, duration: "30 perc", price: "6 000 Ft" },
        { name: { hu: "Talp- és lábmasszázs", en: "Foot & leg massage", de: "Fuß- und Beinmassage", sv: "Fot- och benmassage" }, duration: "30 perc", price: "6 000 Ft" },
        { name: { hu: "Relaxáló hátmasszázs", en: "Relaxing back massage", de: "Entspannende Rückenmassage", sv: "Avslappnande ryggmassage" }, duration: "30 perc", price: "6 000 Ft" }
      ]
    },
    {
      name: { hu: "Gyanták – nőknek", en: "Waxing – women", de: "Waxing – Damen", sv: "Vaxning – kvinnor" },
      compact: true,
      minutes: 30,          // length reserved in the online calendar
      note: {
        hu: "Teljes láb + bikini, illetve teljes láb + bikini + hónalj: kedvezményes áron!",
        en: "Full legs + bikini line, and full legs + bikini line + underarms: at a discounted price!",
        de: "Ganze Beine + Bikinizone sowie ganze Beine + Bikinizone + Achseln: zum Vorzugspreis!",
        sv: "Hela benen + bikinilinje samt hela benen + bikinilinje + armhålor: till rabatterat pris!"
      },
      items: [
        { name: { hu: "Bajusz / áll / pajesz / szemöldök", en: "Upper lip / chin / sideburns / eyebrows", de: "Oberlippe / Kinn / Koteletten / Augenbrauen", sv: "Överläpp / haka / polisonger / ögonbryn" }, price: "1 500 Ft" },
        { name: { hu: "Bajusz + áll + pajesz", en: "Upper lip + chin + sideburns", de: "Oberlippe + Kinn + Koteletten", sv: "Överläpp + haka + polisonger" }, price: "3 500 Ft" },
        { name: { hu: "Térdig", en: "Lower legs (to the knee)", de: "Unterschenkel (bis zum Knie)", sv: "Underben (till knät)" }, price: "3 000 Ft" },
        { name: { hu: "Teljes láb", en: "Full legs", de: "Ganze Beine", sv: "Hela benen" }, price: "5 000 Ft" },
        { name: { hu: "Bikini", en: "Bikini line", de: "Bikinizone", sv: "Bikinilinje" }, price: "2 000 – 2 800 Ft" },
        { name: { hu: "Intim (brazil)", en: "Intimate (Brazilian)", de: "Intim (Brazilian)", sv: "Intim (brasiliansk)" }, price: "3 500 – 4 000 Ft" },
        { name: { hu: "Intim (popsival)", en: "Intimate (incl. buttocks)", de: "Intim (inkl. Po)", sv: "Intim (inkl. skinkor)" }, price: "4 200 – 4 500 Ft" },
        { name: { hu: "Hónalj", en: "Underarms", de: "Achseln", sv: "Armhålor" }, price: "1 500 – 2 000 Ft" },
        { name: { hu: "Kar – alkar / teljes kar", en: "Arms – forearms / full arms", de: "Arme – Unterarme / ganze Arme", sv: "Armar – underarmar / hela armar" }, price: "2 000 – 2 500 Ft" },
        { name: { hu: "Hát", en: "Back", de: "Rücken", sv: "Rygg" }, price: "3 800 Ft" },
        { name: { hu: "Has", en: "Stomach", de: "Bauch", sv: "Mage" }, price: "2 000 Ft" }
      ]
    },
    {
      name: { hu: "Gyanták – férfiaknak", en: "Waxing – men", de: "Waxing – Herren", sv: "Vaxning – män" },
      compact: true,
      minutes: 30,          // length reserved in the online calendar
      items: [
        { name: { hu: "Szemöldök", en: "Eyebrows", de: "Augenbrauen", sv: "Ögonbryn" }, price: "1 500 Ft" },
        { name: { hu: "Mellkas + has", en: "Chest + stomach", de: "Brust + Bauch", sv: "Bröst + mage" }, price: "4 000 – 4 500 Ft" },
        { name: { hu: "Hát + váll", en: "Back + shoulders", de: "Rücken + Schultern", sv: "Rygg + axlar" }, price: "4 000 – 5 000 Ft" },
        { name: { hu: "Láb végig", en: "Full legs", de: "Ganze Beine", sv: "Hela benen" }, price: "5 500 Ft" },
        { name: { hu: "Láb térdig", en: "Lower legs (to the knee)", de: "Unterschenkel (bis zum Knie)", sv: "Underben (till knät)" }, price: "3 500 Ft" },
        { name: { hu: "Kar (alkar + felkar)", en: "Arms (forearms + upper arms)", de: "Arme (Unter- + Oberarme)", sv: "Armar (under- + överarmar)" }, price: "3 000 Ft" }
      ]
    },
    {
      name: { hu: "Festések", en: "Tinting", de: "Färben", sv: "Färgning" },
      intro: { hu: "Refectocil és Orenna professzionális festékekkel.", en: "With professional Refectocil and Orenna tints.", de: "Mit professionellen Farben von Refectocil und Orenna.", sv: "Med professionella färger från Refectocil och Orenna." },
      compact: true,
      minutes: 30,          // length reserved in the online calendar
      items: [
        { name: { hu: "Szempillafestés", en: "Lash tint", de: "Wimpern färben", sv: "Färgning av fransar" }, price: "2 500 Ft" },
        { name: { hu: "Szemöldökfestés", en: "Brow tint", de: "Augenbrauen färben", sv: "Färgning av bryn" }, price: "2 500 Ft" },
        { name: { hu: "Szempilla- + szemöldökfestés (szedéssel)", en: "Lash + brow tint (with shaping)", de: "Wimpern + Augenbrauen färben (mit Zupfen)", sv: "Fransar + bryn (med formning)" }, price: "4 800 Ft" },
        { name: { hu: "Szemöldökszedés, igazítás", en: "Brow shaping & tidy-up", de: "Augenbrauen zupfen & formen", sv: "Formning av bryn" }, price: "1 500 Ft" },
        { name: { hu: "Szempilla- + szemöldökfestés bármelyik arckezelés mellé", en: "Lash + brow tint with any facial", de: "Wimpern + Augenbrauen färben zu jeder Gesichtsbehandlung", sv: "Fransar + bryn i samband med ansiktsbehandling" }, price: "3 800 Ft" }
      ]
    }
  ]
};
