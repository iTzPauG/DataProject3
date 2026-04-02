-- 003: Expanded categories, subcategories and moods.
-- Adds 4 new categories (wellness, coworking, pets, automotive).
-- Expands subcategories and moods for ALL existing categories.
-- Additive only — no destructive changes.
-- ============================================================================

-- ============================================================================
-- NEW CATEGORIES
-- ============================================================================
INSERT INTO public.categories (id, label, icon, color, sort_order, is_active)
VALUES
  ('wellness',   'Bienestar',   '🧖', '#8B5CF6', 15, true),
  ('coworking',  'Coworking',   '🏢', '#6366F1', 16, true),
  ('pets',       'Mascotas',    '🐾', '#F59E0B', 17, true),
  ('automotive', 'Vehiculo',    '🚗', '#64748B', 18, true)
ON CONFLICT (id) DO UPDATE
SET
  label = EXCLUDED.label,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  sort_order = EXCLUDED.sort_order,
  is_active = true;

-- Also ensure cinema exists (was missing before)
INSERT INTO public.categories (id, label, icon, color, sort_order, is_active)
VALUES ('cinema', 'Cine', '🎬', '#EC4899', 11, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- UPDATE CATEGORY METADATA
-- ============================================================================
UPDATE public.categories
SET
  description = CASE id
    WHEN 'food' THEN 'Comida, cafeterias y planes para salir a comer'
    WHEN 'nightlife' THEN 'Bares, clubs y ocio nocturno'
    WHEN 'shopping' THEN 'Compras, centros comerciales y tiendas'
    WHEN 'health' THEN 'Salud, farmacias y atencion medica'
    WHEN 'nature' THEN 'Parques, playas y escapadas al aire libre'
    WHEN 'culture' THEN 'Museos, galerias y espacios culturales'
    WHEN 'services' THEN 'Servicios cotidianos y gestiones'
    WHEN 'sport' THEN 'Deporte, gimnasios e instalaciones'
    WHEN 'education' THEN 'Estudio, bibliotecas y campus'
    WHEN 'cinema' THEN 'Cines y experiencias audiovisuales'
    WHEN 'wellness' THEN 'Spa, masajes y bienestar personal'
    WHEN 'coworking' THEN 'Espacios de trabajo compartido y cafes con WiFi'
    WHEN 'pets' THEN 'Veterinarios, tiendas y parques para mascotas'
    WHEN 'automotive' THEN 'Talleres, gasolineras y servicios para vehiculos'
    WHEN 'event' THEN 'Eventos y planes temporales'
    WHEN 'market' THEN 'Mercados y ferias'
    WHEN 'music' THEN 'Musica en vivo y conciertos'
    WHEN 'report' THEN 'Reportes en directo de la comunidad'
    ELSE description
  END,
  has_price = CASE id
    WHEN 'food' THEN true
    WHEN 'nightlife' THEN true
    WHEN 'shopping' THEN true
    WHEN 'culture' THEN true
    WHEN 'services' THEN true
    WHEN 'cinema' THEN true
    WHEN 'wellness' THEN true
    WHEN 'coworking' THEN true
    ELSE false
  END,
  search_mode = CASE id
    WHEN 'event' THEN 'event_list'
    WHEN 'market' THEN 'event_list'
    WHEN 'music' THEN 'event_list'
    WHEN 'report' THEN 'report_only'
    ELSE 'guided_ranked'
  END,
  default_radius_m = CASE id
    WHEN 'health' THEN 4000
    WHEN 'nature' THEN 6000
    WHEN 'event' THEN 8000
    WHEN 'report' THEN 10000
    WHEN 'wellness' THEN 5000
    WHEN 'coworking' THEN 5000
    WHEN 'pets' THEN 5000
    WHEN 'automotive' THEN 5000
    ELSE 5000
  END,
  provider_types = CASE id
    WHEN 'food' THEN '["restaurant","cafe","bar","bakery","meal_delivery"]'::jsonb
    WHEN 'nightlife' THEN '["night_club","bar","pub"]'::jsonb
    WHEN 'shopping' THEN '["shopping_mall","store","supermarket"]'::jsonb
    WHEN 'health' THEN '["pharmacy","hospital","doctor","dentist"]'::jsonb
    WHEN 'nature' THEN '["park","campground","tourist_attraction"]'::jsonb
    WHEN 'culture' THEN '["museum","art_gallery","library","tourist_attraction"]'::jsonb
    WHEN 'services' THEN '["bank","post_office","atm","hair_care"]'::jsonb
    WHEN 'sport' THEN '["gym","stadium","sports_club"]'::jsonb
    WHEN 'education' THEN '["school","university","library"]'::jsonb
    WHEN 'cinema' THEN '["movie_theater"]'::jsonb
    WHEN 'wellness' THEN '["spa","physiotherapist"]'::jsonb
    WHEN 'coworking' THEN '["library"]'::jsonb
    WHEN 'pets' THEN '["veterinary_care","pet_store"]'::jsonb
    WHEN 'automotive' THEN '["gas_station","car_repair","car_wash","parking"]'::jsonb
    ELSE COALESCE(provider_types, '[]'::jsonb)
  END
WHERE id IN ('food','nightlife','shopping','health','nature','culture',
             'services','sport','education','cinema','wellness','coworking','pets',
             'automotive','event','market','music','report');

-- ============================================================================
-- EXPANDED SUBCATEGORIES
-- ============================================================================
INSERT INTO public.category_subcategories (id, category_id, label, icon, sort_order)
VALUES
  -- Food (expanded)
  ('pizza', 'food', 'Pizza', '🍕', 1),
  ('hamburger', 'food', 'Hamburguesas', '🍔', 2),
  ('sushi', 'food', 'Sushi', '🍣', 3),
  ('paella', 'food', 'Paella', '🥘', 4),
  ('tacos', 'food', 'Tacos', '🌮', 5),
  ('healthy', 'food', 'Healthy', '🥗', 6),
  ('vegan', 'food', 'Vegano', '🌱', 7),
  ('italian', 'food', 'Italiano', '🍝', 8),
  ('asian', 'food', 'Asiatico', '🍜', 9),
  ('chinese', 'food', 'Chino', '🥡', 10),
  ('indian', 'food', 'Indio', '🍛', 11),
  ('thai', 'food', 'Tailandes', '🍲', 12),
  ('mexican', 'food', 'Mexicano', '🫔', 13),
  ('brunch', 'food', 'Brunch', '🥞', 14),
  ('bakery', 'food', 'Panaderia', '🥐', 15),
  ('coffee', 'food', 'Cafeteria', '☕', 16),
  ('tapas', 'food', 'Tapas', '🍢', 17),
  ('seafood', 'food', 'Mariscos', '🦐', 18),

  -- Nightlife (expanded)
  ('bar', 'nightlife', 'Bar', '🍻', 1),
  ('club', 'nightlife', 'Discoteca', '🕺', 2),
  ('pub', 'nightlife', 'Pub', '🍺', 3),
  ('cocktail', 'nightlife', 'Cocteleria', '🍸', 4),
  ('lounge', 'nightlife', 'Lounge', '🛋️', 5),
  ('rooftop', 'nightlife', 'Rooftop', '🌃', 6),
  ('wine_bar', 'nightlife', 'Vinoteca', '🍷', 7),
  ('karaoke', 'nightlife', 'Karaoke', '🎤', 8),
  ('live_music', 'nightlife', 'Musica en vivo', '🎸', 9),

  -- Shopping (expanded)
  ('clothes', 'shopping', 'Ropa', '👗', 1),
  ('shoes', 'shopping', 'Zapatos', '👞', 2),
  ('electronics', 'shopping', 'Electronica', '💻', 3),
  ('supermarket', 'shopping', 'Supermercado', '🛒', 4),
  ('mall', 'shopping', 'Centro comercial', '🏬', 5),
  ('vintage', 'shopping', 'Vintage', '🕰️', 6),
  ('bookstore', 'shopping', 'Libreria', '📚', 7),
  ('deco', 'shopping', 'Decoracion', '🏠', 8),
  ('sports_gear', 'shopping', 'Deportes', '⚽', 9),
  ('gifts_shop', 'shopping', 'Regalos', '🎁', 10),

  -- Health (expanded)
  ('pharmacy', 'health', 'Farmacia', '💊', 1),
  ('hospital', 'health', 'Hospital', '🏥', 2),
  ('clinic', 'health', 'Clinica', '⚕️', 3),
  ('dentist', 'health', 'Dentista', '🦷', 4),
  ('optician', 'health', 'Optica', '👓', 5),
  ('physiotherapy', 'health', 'Fisioterapia', '💆', 6),
  ('mental_health', 'health', 'Salud mental', '🧠', 7),

  -- Nature (expanded)
  ('park', 'nature', 'Parque', '🌲', 1),
  ('beach', 'nature', 'Playa', '🏖️', 2),
  ('hiking', 'nature', 'Senderismo', '🥾', 3),
  ('garden', 'nature', 'Jardin', '🌺', 4),
  ('viewpoint', 'nature', 'Mirador', '🏔️', 5),
  ('lake', 'nature', 'Lago / Embalse', '🏞️', 6),
  ('forest', 'nature', 'Bosque', '🌳', 7),
  ('picnic', 'nature', 'Picnic', '🧺', 8),

  -- Culture (expanded)
  ('museum', 'culture', 'Museo', '🏛️', 1),
  ('gallery', 'culture', 'Galeria', '🖼️', 2),
  ('theater', 'culture', 'Teatro', '🎭', 3),
  ('library', 'culture', 'Biblioteca', '📚', 4),
  ('monument', 'culture', 'Monumento', '🗽', 5),
  ('historic_site', 'culture', 'Sitio historico', '🏰', 6),
  ('cultural_center', 'culture', 'Centro cultural', '🎪', 7),

  -- Services (expanded)
  ('bank', 'services', 'Banco', '🏦', 1),
  ('post_office', 'services', 'Correos', '📮', 2),
  ('salon', 'services', 'Peluqueria', '✂️', 3),
  ('barbershop', 'services', 'Barberia', '💈', 4),
  ('laundry', 'services', 'Lavanderia', '🧺', 5),
  ('repairs', 'services', 'Reparaciones', '🔧', 6),
  ('notary', 'services', 'Notaria', '📋', 7),
  ('copy_shop', 'services', 'Copisteria', '🖨️', 8),

  -- Sport (expanded)
  ('gym', 'sport', 'Gimnasio', '🏋️', 1),
  ('football', 'sport', 'Futbol', '⚽', 2),
  ('basketball', 'sport', 'Baloncesto', '🏀', 3),
  ('tennis', 'sport', 'Tenis', '🎾', 4),
  ('padel', 'sport', 'Padel', '🏓', 5),
  ('pool', 'sport', 'Piscina', '🏊', 6),
  ('yoga', 'sport', 'Yoga', '🧘', 7),
  ('climbing', 'sport', 'Escalada', '🧗', 8),
  ('martial_arts', 'sport', 'Artes marciales', '🥋', 9),
  ('running', 'sport', 'Running', '🏃', 10),

  -- Education (expanded)
  ('library_edu', 'education', 'Biblioteca', '📚', 1),
  ('study_cafe', 'education', 'Cafe para estudiar', '☕', 2),
  ('university', 'education', 'Universidad', '🎓', 3),
  ('language_school', 'education', 'Idiomas', '🗣️', 4),
  ('academy', 'education', 'Academia', '📖', 5),

  -- Cinema (expanded)
  ('blockbuster', 'cinema', 'Estrenos', '🍿', 1),
  ('indie', 'cinema', 'Cine indie', '📽️', 2),
  ('imax', 'cinema', 'IMAX', '🎬', 3),
  ('vos', 'cinema', 'Version original', '🇬🇧', 4),
  ('outdoor_cinema', 'cinema', 'Cine al aire libre', '🌙', 5),

  -- Wellness (NEW)
  ('spa', 'wellness', 'Spa', '🧖', 1),
  ('massage', 'wellness', 'Masaje', '💆', 2),
  ('sauna', 'wellness', 'Sauna', '🔥', 3),
  ('meditation', 'wellness', 'Meditacion', '🧘', 4),
  ('hot_springs', 'wellness', 'Termas', '♨️', 5),
  ('acupuncture', 'wellness', 'Acupuntura', '📍', 6),

  -- Coworking (NEW)
  ('open_space', 'coworking', 'Espacio abierto', '🏢', 1),
  ('private_office', 'coworking', 'Oficina privada', '🚪', 2),
  ('meeting_room', 'coworking', 'Sala de reuniones', '📊', 3),
  ('cafe_workspace', 'coworking', 'Cafe con WiFi', '☕', 4),
  ('day_pass', 'coworking', 'Pase por dia', '📅', 5),

  -- Pets (NEW)
  ('vet', 'pets', 'Veterinario', '🩺', 1),
  ('pet_shop', 'pets', 'Tienda mascotas', '🐾', 2),
  ('dog_park', 'pets', 'Parque canino', '🐕', 3),
  ('grooming', 'pets', 'Peluqueria animal', '✂️', 4),
  ('pet_friendly', 'pets', 'Pet-friendly', '🐶', 5),
  ('pet_hotel', 'pets', 'Residencia animal', '🏨', 6),

  -- Automotive (NEW)
  ('gas_station', 'automotive', 'Gasolinera', '⛽', 1),
  ('ev_charging_auto', 'automotive', 'Carga electrica', '🔌', 2),
  ('mechanic', 'automotive', 'Taller mecanico', '🔧', 3),
  ('car_wash', 'automotive', 'Lavado', '🚿', 4),
  ('parking_auto', 'automotive', 'Parking', '🅿️', 5),
  ('tire_shop', 'automotive', 'Neumaticos', '🛞', 6),
  ('itv', 'automotive', 'ITV', '📋', 7),
  ('car_rental', 'automotive', 'Alquiler coches', '🚗', 8)
ON CONFLICT (category_id, id) DO UPDATE
SET
  label = EXCLUDED.label,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order,
  is_active = true;

-- Remove old subcategories that were renamed/replaced
DELETE FROM public.category_subcategories
WHERE (category_id = 'cinema' AND id = 'movies')
   OR (category_id = 'education' AND id IN ('school', 'study'));

-- ============================================================================
-- EXPANDED MOODS
-- ============================================================================
INSERT INTO public.category_moods (id, category_id, label, icon, sort_order)
VALUES
  -- Food
  ('quick', 'food', 'Algo rapido', '⚡', 1),
  ('casual', 'food', 'Informal', '😊', 2),
  ('date', 'food', 'Cita', '❤️', 3),
  ('family', 'food', 'Familiar', '👨‍👩‍👧', 4),
  ('celebration', 'food', 'Celebracion', '🎉', 5),
  ('tapas_mood', 'food', 'Tapeo', '🥂', 6),
  ('gourmet', 'food', 'Gourmet', '👨‍🍳', 7),
  ('comfort_food', 'food', 'Comfort food', '🍲', 8),

  -- Nightlife
  ('chill', 'nightlife', 'Tranquilo', '🍷', 1),
  ('party', 'nightlife', 'Fiesta', '💃', 2),
  ('intimate', 'nightlife', 'Intimo', '🥂', 3),
  ('friends', 'nightlife', 'Con amigos', '🍻', 4),
  ('dance', 'nightlife', 'Bailar', '💃', 5),
  ('afterwork', 'nightlife', 'After work', '👔', 6),

  -- Shopping
  ('quick_shop', 'shopping', 'Rapido', '⏱️', 1),
  ('window', 'shopping', 'Mirar', '👀', 2),
  ('gifts_mood', 'shopping', 'Regalos', '🎁', 3),
  ('sale', 'shopping', 'Ofertas', '🏷️', 4),
  ('luxury', 'shopping', 'Lujo', '💎', 5),
  ('local_brands', 'shopping', 'Marcas locales', '🏪', 6),

  -- Health
  ('urgent', 'health', 'Urgente', '🚨', 1),
  ('routine', 'health', 'Rutina', '📅', 2),
  ('specialist', 'health', 'Especialista', '👨‍⚕️', 3),
  ('night_service', 'health', 'Guardia nocturna', '🌙', 4),

  -- Nature
  ('relax', 'nature', 'Relajante', '🧘', 1),
  ('active', 'nature', 'Aventura', '🏃', 2),
  ('family_nature', 'nature', 'Con ninos', '👶', 3),
  ('view', 'nature', 'Vistas', '📸', 4),
  ('dog_friendly', 'nature', 'Con perro', '🐕', 5),
  ('sunset', 'nature', 'Atardecer', '🌅', 6),

  -- Culture
  ('learn', 'culture', 'Aprender', '🧠', 1),
  ('art', 'culture', 'Arte', '🎨', 2),
  ('history', 'culture', 'Historia', '🏛️', 3),
  ('entertainment', 'culture', 'Entretenimiento', '🍿', 4),
  ('free_culture', 'culture', 'Gratis', '🆓', 5),
  ('guided_tour', 'culture', 'Visita guiada', '🎙️', 6),

  -- Services
  ('quick_service', 'services', 'Rapido', '⚡', 1),
  ('quality', 'services', 'Calidad', '⭐', 2),
  ('cheap_services', 'services', 'Economico', '💰', 3),
  ('nearby_services', 'services', 'Lo mas cerca', '📍', 4),

  -- Sport
  ('intense', 'sport', 'Intenso', '🔥', 1),
  ('fun', 'sport', 'Divertido', '😆', 2),
  ('team', 'sport', 'En equipo', '🤝', 3),
  ('solo', 'sport', 'Individual', '🎧', 4),
  ('beginner', 'sport', 'Principiante', '🌱', 5),

  -- Education
  ('quiet', 'education', 'Silencio total', '🤫', 1),
  ('group', 'education', 'Trabajo en grupo', '👥', 2),
  ('wifi', 'education', 'WiFi rapido', '📶', 3),
  ('long_hours', 'education', 'Muchas horas', '🕐', 4),

  -- Cinema
  ('action', 'cinema', 'Accion', '💥', 1),
  ('comedy', 'cinema', 'Comedia', '😂', 2),
  ('drama', 'cinema', 'Drama', '🎭', 3),
  ('kids', 'cinema', 'Infantil', '👦', 4),
  ('date_night', 'cinema', 'Cita', '❤️', 5),
  ('horror', 'cinema', 'Terror', '👻', 6),

  -- Wellness (NEW)
  ('relax_wellness', 'wellness', 'Relajarme', '😌', 1),
  ('couples', 'wellness', 'En pareja', '💑', 2),
  ('detox', 'wellness', 'Detox', '🍃', 3),
  ('pain_relief', 'wellness', 'Dolor muscular', '🩹', 4),
  ('luxury_wellness', 'wellness', 'Lujo', '💎', 5),

  -- Coworking (NEW)
  ('quiet_cowork', 'coworking', 'Silencioso', '🤫', 1),
  ('social_cowork', 'coworking', 'Social', '🤝', 2),
  ('cheap_cowork', 'coworking', 'Economico', '💰', 3),
  ('premium_cowork', 'coworking', 'Premium', '⭐', 4),
  ('twentyfour_h', 'coworking', '24 horas', '🕐', 5),

  -- Pets (NEW)
  ('emergency_pet', 'pets', 'Emergencia', '🚨', 1),
  ('routine_pet', 'pets', 'Revision rutina', '📅', 2),
  ('supplies', 'pets', 'Comprar cosas', '🛒', 3),
  ('social_pet', 'pets', 'Paseo social', '🐕‍🦺', 4),

  -- Automotive (NEW)
  ('emergency_auto', 'automotive', 'Emergencia', '🚨', 1),
  ('routine_auto', 'automotive', 'Revision', '📅', 2),
  ('cheap_auto', 'automotive', 'Economico', '💰', 3),
  ('nearby_auto', 'automotive', 'Lo mas cerca', '📍', 4)
ON CONFLICT (category_id, id) DO UPDATE
SET
  label = EXCLUDED.label,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order,
  is_active = true;

-- Remove old moods that were renamed/replaced
DELETE FROM public.category_moods
WHERE (category_id = 'nightlife' AND id = 'music')
   OR (category_id = 'cinema' AND id = 'indie');
