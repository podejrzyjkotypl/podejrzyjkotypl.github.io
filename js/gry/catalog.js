// Katalog przedmiotów (rozszerzalny: ubranka z poziomami, ramki profilu, kolejne mini-gry)
Wallet.register([
 // Kotek: ubranka (game 'kotek', slot = miejsce na ciele)
 {id:'kokarda',game:'kotek',slot:'glowa',n:'Kokarda',ic:'🎀',rarity:'zwykle',price:40},
 {id:'obroza',game:'kotek',slot:'szyja',n:'Obroża z dzwonkiem',ic:'🔔',rarity:'zwykle',price:45},
 {id:'okulary',game:'kotek',slot:'oczy',n:'Okulary',ic:'🕶️',rarity:'zwykle',price:50},
 {id:'czapka',game:'kotek',slot:'glowa',n:'Czapka',ic:'🧢',rarity:'rzadkie',price:60},
 {id:'szalik',game:'kotek',slot:'szyja',n:'Szalik',ic:'🧣',rarity:'rzadkie',price:70},
 {id:'sweterek',game:'kotek',slot:'cialo',n:'Sweterek',ic:'🧶',rarity:'epickie',price:120},
 {id:'korona',game:'kotek',slot:'glowa',n:'Korona',ic:'👑',rarity:'legendarne',price:200},
 // Snake: futro
 {id:'s-futro-rude',game:'snake',slot:'futro',n:'Rude futro',ic:'🟠',rarity:'zwykle',price:0,v:{h:'#ffad70',b:'#ff9d5c'}},
 {id:'s-futro-bure',game:'snake',slot:'futro',n:'Bure futro',ic:'🟤',rarity:'zwykle',price:30,v:{h:'#a39684',b:'#8c7f6e',s:'#5e5347'}},
 {id:'s-futro-czarne',game:'snake',slot:'futro',n:'Czarne futro',ic:'⚫',rarity:'rzadkie',price:80,v:{h:'#3d3848',b:'#2e2a37'}},
 {id:'s-futro-biale',game:'snake',slot:'futro',n:'Białe futro',ic:'⚪',rarity:'rzadkie',price:80,v:{h:'#f6f2ec',b:'#e7e1d8'}},
 {id:'s-futro-tricolor',game:'snake',slot:'futro',n:'Tricolor',ic:'🎨',rarity:'epickie',price:180,v:{h:'#f6f2ec',b:'#e7e1d8',p:['#ff9d5c','#2e2a35']}},
 {id:'s-futro-kosmos',game:'snake',slot:'futro',n:'Kosmiczny kot',ic:'🌌',rarity:'legendarne',price:450,v:{h:'#6b4bd6',b:'#4a33a8',p:['#ff8adf','#5fd1ff']}},
 // Snake: na głowę
 {id:'s-kokarda',game:'snake',slot:'glowa',n:'Kokarda',ic:'🎀',rarity:'zwykle',price:25},
 {id:'s-czapka',game:'snake',slot:'glowa',n:'Czapka mikołaja',ic:'🎅',rarity:'rzadkie',price:70},
 {id:'s-okulary',game:'snake',slot:'glowa',n:'Okulary',ic:'🕶️',rarity:'epickie',price:150},
 {id:'s-korona',game:'snake',slot:'glowa',n:'Korona',ic:'👑',rarity:'legendarne',price:400},
 // Snake: ślad
 {id:'s-slad-lapki',game:'snake',slot:'slad',n:'Łapki',ic:'🐾',rarity:'zwykle',price:30},
 {id:'s-slad-serca',game:'snake',slot:'slad',n:'Serduszka',ic:'💖',rarity:'rzadkie',price:90},
 {id:'s-slad-iskry',game:'snake',slot:'slad',n:'Iskierki',ic:'✨',rarity:'epickie',price:200},
 {id:'s-slad-tecza',game:'snake',slot:'slad',n:'Tęcza',ic:'🌈',rarity:'legendarne',price:500},
]);
