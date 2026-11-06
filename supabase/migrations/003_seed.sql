-- Ámbar PWA: datos iniciales tomados de "AMBAR CARTA og.pdf" y "Desayuno ámbar .pdf".
-- Idempotente para los menús 'desayuno' y 'ambar' (se recrean). No toca clientes ni pedidos.

update settings set data = $json$
{
  "business": {
    "name": "Ámbar Steak House",
    "tagline": "Ahumados, cortes y burgers en San Andrés",
    "chef": "@aldaarizachef",
    "chef_url": "https://www.instagram.com/aldaarizachef",
    "location": "Punta Hansa, frente hotel Arena Blanca",
    "award": "Island Burger 2024",
    "music": "@ambarmusicvibes",
    "music_url": "https://www.instagram.com/ambarmusicvibes"
  },
  "contact": {
    "whatsapp": "573229089680",
    "instagram_url": "https://www.instagram.com/ambarsteakhouse_",
    "google_review_url": "https://search.google.com/local/writereview?placeid=ChIJS8IK_uWvBY8RRvIb-KGKVzg",
    "tripadvisor_url": "https://www.tripadvisor.co/Restaurant_Review-g297482-d27184355-Reviews-Ambar_Steak_House-San_Andres_Island_San_Andres_and_Providencia_Department.html",
    "maps_url": "https://www.google.com/maps/place/?q=place_id:ChIJS8IK_uWvBY8RRvIb-KGKVzg"
  },
  "theme": {
    "colors": { "bg": "#0E0E10", "surface": "#18181B", "border": "#2A2A2E", "gold": "#D4A24C", "amber": "#F08A24", "text": "#F5F5F4", "muted": "#A1A1AA" },
    "fonts": { "heading": "Montserrat", "body": "Inter" }
  },
  "landing": {
    "headline": "Fuego, humo y sabor isleño",
    "subheadline": "Cortes ahumados, burgers premiadas y cócteles frente al mar.",
    "video": "landing/hero.mp4",
    "images": ["landing/1.webp","landing/4.webp","landing/10.webp","landing/3.webp","landing/5.webp","landing/8.webp","landing/2.webp","landing/9.webp","landing/6.webp","landing/7.webp"]
  }
}
$json$::jsonb, updated_at = now() where id = 1;

delete from menus where slug in ('desayuno', 'ambar');

do $$
declare
  m uuid;
  c uuid;
  csort int := 0;
  rec jsonb;
  i int;
  -- items: [[nombre, descripcion, precio, imagen|null, destacado], ...]
begin
  -- ─────────────── DESAYUNO ───────────────
  insert into menus (slug, name, subtitle, start_time, end_time, sort)
  values ('desayuno', 'Desayuno', 'De 4:00 a. m. a 10:59 a. m.', '04:00', '10:59', 1) returning id into m;

  for rec in select * from jsonb_array_elements($j$[
    {"cat": "Huevos", "items": [
      ["Sencillos", "Huevos revueltos o enteros, acompañados de arepa o pan. Incluye café o chocolate.", 18000],
      ["Huevos al gusto", "Tomate y cebolla, jamón y queso, rancheros o salchicha. Acompañados de pan o arepa. Incluye café o chocolate.", 22000],
      ["Huevos con todo", "Tomate y cebolla, ranchera, queso y tocineta. Acompañados de pan o arepa. Incluye café o chocolate.", 25000],
      ["Americanos", "Huevo frito, tocineta, pan y café.", 25000]
    ]},
    {"cat": "Tostadas", "items": [
      ["Tostadas", "Huevos al gusto (revuelto, frito o cocido) con crema de aguacate.", 18000],
      ["Tostada Ámbar", "Huevos pochados, queso campesino asado, tomate en rodajas y tocineta.", 26000],
      ["Tostada Americana", "Huevo frito, tocineta, tostada con crema de aguacate, tomates cherry y reducción de flor de Jamaica.", 24000]
    ]},
    {"cat": "Sándwiches", "items": [
      ["Sándwich", "Jamón y queso y salsa de la casa.", 7000],
      ["Sándwich Croissant", "Jamón y queso, huevo revuelto y lechuga.", 22000],
      ["Sándwich Pulled", "Cerdo desmechado con queso ahumado.", 22000]
    ]},
    {"cat": "Combos", "items": [
      ["Combo 1", "Huevos en cazuela con chorizo artesanal, acompañados de pan o arepa. Incluye bebida: café o chocolate.", 25000],
      ["Combo 2", "Huevos con brisket o pulled, acompañados de pan o arepa. Incluye bebida: café o chocolate.", 26000]
    ]},
    {"cat": "Adiciones", "items": [
      ["Pan", null, 4000], ["Arepa", null, 3500], ["Ranchera", null, 4000],
      ["Queso", null, 4000], ["Tomate y cebolla", null, 4000], ["Tocineta", null, 5000]
    ]},
    {"cat": "Bebidas", "items": [
      ["Café", null, 5000], ["Café con leche", null, 6000], ["Chocolate", null, 8000],
      ["Milo frío", null, 10000], ["Jugos naturales", null, 10000], ["Café frío", null, 11000],
      ["Milo caliente", null, 8000], ["Jugo de banano", null, 12000], ["Jugo verde", null, 15000]
    ]}
  ]$j$::jsonb) loop
    csort := csort + 1;
    insert into categories (menu_id, name, sort) values (m, rec->>'cat', csort) returning id into c;
    for i in 0 .. jsonb_array_length(rec->'items') - 1 loop
      insert into products (category_id, name, description, price, images, featured, sort)
      values (c, rec->'items'->i->>0, rec->'items'->i->>1, (rec->'items'->i->>2)::int,
              case when rec->'items'->i->>3 is null then '{}'::text[] else array[rec->'items'->i->>3] end,
              coalesce((rec->'items'->i->>4)::boolean, false), i + 1);
    end loop;
  end loop;

  -- ─────────────── ÁMBAR ───────────────
  csort := 0;
  insert into menus (slug, name, subtitle, start_time, end_time, sort)
  values ('ambar', 'Carta Ámbar', 'Desde las 11:00 a. m.', '11:00', '03:59', 2) returning id into m;

  for rec in select * from jsonb_array_elements($j$[
    {"cat": "Entradas", "items": [
      ["Chicharrón con guacamole", "200 g de tocino crocante ahumado acompañado de guacamole artesanal.", 35000, "landing/2.webp"],
      ["Empanadas de brisket", "Empanada tipo argentina rellena de pecho ahumado 10 h y queso mozzarella, acompañada de chimichurri de limón fermentado.", 32000, "landing/10.webp"],
      ["Carimañola de brisket", "4 carimañolas rellenas de pecho ahumado, acompañadas de suero costeño ahumado.", 34000],
      ["Tenders chicken", "Lomitos de pechuga apanados crujientes acompañados con salsa de la casa.", 29000],
      ["Bruschettas de roast beef", "Montadito en base de pan de masa madre, mostaza Dijon, roast beef ahumado y reducción de flor de Jamaica.", 34000],
      ["Entrada de chorizo", "2 chorizos artesanales acompañados con bollito frito y suero ahumado.", 33000],
      ["Ceviche de chicharrón", "Delicioso y crujiente chicharrón en ceviche.", 34000],
      ["Wings Chili", "8 alitas de pollo en salsa sweet chili de licor de maíz.", 26000, "landing/3.webp"],
      ["Marranitas", "4 bolitas de plátano verde rellenas de chicharrón y sofrito.", 33000]
    ]},
    {"cat": "Steak House", "items": [
      ["Baby beef", "200 g de lomo fino de res pincelado con mantequilla de romero ahumada. Acompáñalo con puré de papa criolla, papa francesa, papa criolla con tocineta, mazorquitas o ensalada fresca.", 67000, "landing/4.webp"],
      ["Rib eye", "300 g de corte grueso de la parte superior de las costillas de la res, terminado con mantequilla de romero ahumada. Acompáñalo con puré de papa criolla, papa francesa, papa criolla con tocineta, mazorquitas o ensalada fresca.", 95000, null, true],
      ["Costillas BBQ", "300 g de tiernas costillas de cerdo ahumadas 8 h y bañadas en salsa BBQ artesanal. Acompáñalas con puré de papa criolla, papa francesa, papa criolla con tocineta, mazorquitas o ensalada fresca.", 60000],
      ["Punta de anca", "200 g de corte de res pincelado con mantequilla de romero ahumada. Acompáñalo con puré de papa criolla, papa francesa, papa criolla con tocineta, mazorquitas o ensalada fresca.", 75000, "landing/5.webp"],
      ["Tomahawk", "Corte grueso con hueso de la parte superior de las costillas de la res, terminado con mantequilla de romero ahumada. Acompáñalo con puré de papa criolla, papa francesa, papa criolla con tocineta, mazorquitas o ensalada fresca.", 140000, null, true],
      ["Costillas de res", "300 g de tiernas costillas de res ahumadas 8 h y bañadas en salsa de carne. Acompáñalas con puré de papa criolla, papa francesa, papa criolla con tocineta, mazorquitas o ensalada fresca.", 65000]
    ]},
    {"cat": "Picadas", "items": [
      ["Smoked", "Picada para 2: tocino, costilla de cerdo y brisket, servida con mazorquitas y papa criolla.", 110000, "landing/8.webp", true],
      ["House", "Picada para 2: trozos de res, chorizo, chicharrón, 4 empanadas de queso y patacones.", 95000]
    ]},
    {"cat": "Adiciones", "items": [
      ["150 g brisket", null, 20000], ["150 g pulled pork", null, 18000],
      ["Alitas", null, 17000], ["180 g tocino", null, 25000]
    ]},
    {"cat": "Sándwiches", "items": [
      ["Sándwich Brisket", "Pecho de res ahumado 10 h bañado en BBQ hecha en casa, pan de masa madre, queso munster, lechuga, cebolla crispy y mayonesa de ajo ahumada. Con papa francesa y salsa de la casa.", 48000, null, true],
      ["Sándwich Steak", "Lomo de res salteado con mantequilla ahumada de romero, pan de masa madre, chimichurri de limón fermentado, queso provolone y cebolla caramelizada. Con papa francesa y salsa de la casa.", 45000, "landing/9.webp"],
      ["Sándwich Roast Beef", "Lomo ancho de res ahumado en madera, pan de masa madre, queso mozzarella, mostaza y pepinillos caseros. Con papa francesa y salsa de la casa.", 46000],
      ["Sándwich Pulled Pork", "Paleta de cerdo ahumada 12 h en salsa BBQ, queso mozzarella, lechuga y cebolla crispy. Con papa francesa y salsa de la casa.", 46000]
    ]},
    {"cat": "Island Burger 2024 🏆", "items": [
      ["Barkhu", "Ganadora Island Burger SAI. Pan con corteza de croissant, 180 g de carne 100 % res ahumada, queso provolone asado, tomate cherry y salsa pesto. Con papa francesa y salsa de la casa.", 42000, null, true]
    ]},
    {"cat": "Hamburguesas", "items": [
      ["Mounster", "180 g de carne 100 % res ahumada, queso mozzarella, tocineta y cebolla crispy. Con papa francesa y salsa de la casa.", 40000, "landing/1.webp"],
      ["Pollo crispy", "Pechuga de pollo crispy, pico de gallo, queso provolone, lechuga y salsa pesto.", 40000]
    ]},
    {"cat": "Kids", "items": [
      ["Alitas kids", "6 alitas de pollo con papita a la francesa, salsa de tomate y helado.", 30000]
    ]},
    {"cat": "Jueves Mexicanos", "items": [
      ["Taco de brisket", "Tortilla con costra de queso, chipotle ahumado, guacamole y pico de gallo. Solo jueves.", 18000],
      ["Taco de res tipo birria", "Costilla de res, costra de queso y pico de gallo. Solo jueves.", 17000],
      ["Taco de chorizo", "Chorizo santorrosano, suero ahumado, queso y chimichurri. Solo jueves.", 15000],
      ["Taco pulled", "Pico de gallo, queso rallado y BBQ. Solo jueves.", 17000],
      ["Taco steak", "Guacamole, queso rallado y chimichurri. Solo jueves.", 17000],
      ["Taquero", "Tacos de brisket, res tipo birria, chorizo y pulled. Solo jueves.", 63000],
      ["Nachos", "Pulled y res, queso rallado, pico de gallo, crema agria y guacamole. Solo jueves.", 37000],
      ["Elotes", "Maíz desgranado con crema agria y queso rallado. Solo jueves.", 27000]
    ]},
    {"cat": "Cervezas", "items": [
      ["Andina", null, 8000], ["Poker", null, 8000], ["Club Colombia", null, 10000],
      ["Stella Artois", null, 13000], ["Corona", null, 12000], ["Vaso michelado", null, 3000]
    ]},
    {"cat": "Sodas", "items": [
      ["Soda", null, 9000], ["Ginger Ale", null, 10000],
      ["Soda saborizada", "Flor de Jamaica, maracuyá o cereza.", 18000]
    ]},
    {"cat": "Gaseosas", "items": [
      ["Coca-Cola", null, 8000], ["Coca-Cola Zero", null, 8000], ["Manzana", null, 7000], ["Agua saborizada", null, 6000]
    ]},
    {"cat": "Jugos", "items": [
      ["Limonada cerezada", null, 18000], ["Limonada brasileña", null, 18000], ["Limonada natural", null, 15000],
      ["Jugos naturales", null, 15000], ["Jugos en leche", null, 18000]
    ]},
    {"cat": "Cócteles", "items": [
      ["Mojito", null, 30000], ["Mojito kiwi", null, 32000], ["Mojito maracuyá", null, 32000], ["Mojito fresa", null, 32000],
      ["Gin tonic", null, 35000], ["Gin tonic frutos rojos", null, 35000], ["Moscow mule", null, 35000], ["Ron Cuba", null, 35000],
      ["Margarita", null, 32000], ["Jarra de sangría", null, 120000], ["Vino tinto (botella)", null, 75000], ["Vino rosé (botella)", null, 70000],
      ["Caipiriña", null, 30000], ["Caipiroska", null, 32000], ["Aperol frozen", null, 35000], ["Aperol spritz", null, 32000]
    ]}
  ]$j$::jsonb) loop
    csort := csort + 1;
    insert into categories (menu_id, name, sort) values (m, rec->>'cat', csort) returning id into c;
    for i in 0 .. jsonb_array_length(rec->'items') - 1 loop
      insert into products (category_id, name, description, price, images, featured, sort)
      values (c, rec->'items'->i->>0, rec->'items'->i->>1, (rec->'items'->i->>2)::int,
              case when rec->'items'->i->>3 is null then '{}'::text[] else array[rec->'items'->i->>3] end,
              coalesce((rec->'items'->i->>4)::boolean, false), i + 1);
    end loop;
  end loop;
end $$;

insert into rewards (name, description, stars_required, sort)
select 'Postre de la casa', 'Reclámalo al completar tus estrellas.', 5, 1
where not exists (select 1 from rewards);
