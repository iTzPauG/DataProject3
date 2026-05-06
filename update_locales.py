import json

def update_locales():
    with open("main/frontend/locales/es.json", "r", encoding="utf-8") as f:
        es = json.load(f)
        
    es["loading_variations"] = [
        "Consultando a los paladares más exigentes...",
        "Analizando el ambiente y la calidad...",
        "Buscando las mejores mesas en la ciudad...",
        "Calculando la distancia hasta tu próximo antojo...",
        "Revisando qué dicen los locales de verdad...",
        "Cruzando datos de Google, Yelp y Tripadvisor...",
        "Descartando trampas para turistas...",
        "Afilando el algoritmo gastronómico...",
        "Preparando recomendaciones que no fallan...",
        "Cocinando a fuego lento tu lista perfecta...",
        "Buscando lugares que valgan cada céntimo...",
        "Leyendo entre líneas las reseñas más sinceras...",
        "Mapeando los rincones más recomendables...",
        "Ajustando los filtros para tu estado de ánimo...",
        "Filtrando el ruido para darte lo mejor..."
    ]
    
    es["profile_variations"] = [
        "Tu pasaporte a los mejores sitios.",
        "El mapa del tesoro de tu ciudad.",
        "Guarda, compara y no te equivoques nunca.",
        "Tu lista personal de descubrimientos.",
        "El directorio de tus próximas aventuras.",
        "Lugares que ya no olvidarás.",
        "Tu archivo de recomendaciones infalibles.",
        "El rincón de tus favoritos.",
        "Donde guardas lo que de verdad importa.",
        "Tu historial de buen gusto.",
        "Coleccionando momentos y coordenadas.",
        "Tu agenda gastronómica personal.",
        "Tus rincones de confianza.",
        "El club exclusivo de tus sitios guardados.",
        "Tus descubrimientos, ordenados y listos."
    ]

    with open("main/frontend/locales/es.json", "w", encoding="utf-8") as f:
        json.dump(es, f, indent=2, ensure_ascii=False)

    # For en.json
    with open("main/frontend/locales/en.json", "r", encoding="utf-8") as f:
        en = json.load(f)
        
    en["loading_variations"] = [
        "Consulting the most demanding palates...",
        "Analyzing vibe and quality...",
        "Scouting the best tables in town...",
        "Calculating the distance to your next craving...",
        "Checking what true locals are saying...",
        "Cross-referencing Google, Yelp, and Tripadvisor...",
        "Filtering out the tourist traps...",
        "Sharpening the gastronomic algorithm...",
        "Preparing recommendations that won't miss...",
        "Slow-cooking your perfect list...",
        "Finding places worth every penny...",
        "Reading between the lines of honest reviews...",
        "Mapping out the most highly recommended spots...",
        "Adjusting filters for your current mood...",
        "Cutting through the noise to give you the best..."
    ]
    
    en["profile_variations"] = [
        "Your passport to the best spots.",
        "The treasure map to your city.",
        "Save, compare, and never guess wrong.",
        "Your personal list of discoveries.",
        "The directory of your next adventures.",
        "Places you won't forget anymore.",
        "Your archive of infallible recommendations.",
        "The corner for your favorites.",
        "Where you save what truly matters.",
        "Your history of good taste.",
        "Collecting moments and coordinates.",
        "Your personal gastronomic agenda.",
        "Your trusted corners.",
        "The exclusive club of your saved places.",
        "Your discoveries, sorted and ready."
    ]

    with open("main/frontend/locales/en.json", "w", encoding="utf-8") as f:
        json.dump(en, f, indent=2, ensure_ascii=False)

update_locales()
