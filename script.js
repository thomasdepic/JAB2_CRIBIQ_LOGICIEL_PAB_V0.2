document.addEventListener("DOMContentLoaded", function () {
    console.log("DOM chargé, exécution du script...");

//* Intialisation 

//* Vérification des boutons de sauvegarde et chargement
    var saveButton = document.getElementById("saveFile");
    var loadButton = document.getElementById("loadFile");
    var fileInput = document.getElementById("fileInput");

    if (!saveButton || !loadButton || !fileInput) {
        console.error("⚠️ Les boutons de sauvegarde/chargement ne sont pas trouvés !");
        return;
    } else {
        console.log("✅ Boutons trouvés !");
    }
//* Initialisation des variables globales
    var polygon = null;  // Polygone principal
    var bufferLayer = null;  // Buffer (polygone réduit)
    var bufferVisible = true; // État du buffer (affiché par défaut)
    var distanceLabels = []; // Labels des longueurs des arêtes

    // Initialisation du curseur de profondeur
    var profondeur = 2; // Valeur initiale de la profondeur
    var profondeurSlider = document.getElementById('profondeurSlider');
    var profondeurValue = document.getElementById('profondeurValue');

    profondeurSlider.addEventListener('input', function() {
        profondeur = parseFloat(this.value);
        profondeurValue.textContent = profondeur;
        console.log("Nouvelle profondeur : " + profondeur);
        updateBuffer(); // Mettre à jour le buffer en temps réel
    });

    // Initialisation de la pente
    var pente = 33; // Valeur initiale de la pente en %
    var penteSlider = document.getElementById('penteSlider');
    var penteValue = document.getElementById('penteValue');

    penteSlider.addEventListener('input', function() {
        pente = parseFloat(this.value);
        penteValue.textContent = pente;
        console.log("Nouvelle pente : " + pente + "%");
    });

    // ⚡️ Initialisation de la carte
    var map = L.map('map', { editable: true }).setView([48.8566, 2.3522], 13);
    map.doubleClickZoom.disable();

    // Ajouter une couche OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors'
    }).addTo(map);

    // 🔹 Géolocalisation utilisateur
    map.locate({ setView: true, maxZoom: 16 });

    function onLocationFound(e) {
        var radius = e.accuracy;
        L.marker(e.latlng).addTo(map)
            .bindPopup("Vous êtes à " + radius.toFixed(1) + " mètres de précision").openPopup();
        L.circle(e.latlng, { radius: radius }).addTo(map);
    }

    map.on('locationfound', onLocationFound);
    map.on('locationerror', function(e) {
        alert("Impossible de récupérer votre position : " + e.message);
    });

//* Informations sur le polygone : air et longueur des aretes
    // Fonction pour calculer la distance entre deux points
    function calculateDistance(latlng1, latlng2) {
        return map.distance(latlng1, latlng2).toFixed(2);
    }

     // Fonction pour calculer et mettre à jour l'aire du polygone dans la bulle d'information
     function updatePolygonArea() {
        if (polygon) {
            var coords = polygon.getLatLngs()[0].map(latlng => [latlng.lng, latlng.lat]);
            coords.push(coords[0]); // Fermer le polygone

            var polygonGeoJSON = turf.polygon([coords]);
            var area = turf.area(polygonGeoJSON);
            var areaText = area > 1000000
                ? (area / 1000000).toFixed(2) + " km²"
                : area.toFixed(2) + " m²";

            document.getElementById("infoBubble").innerHTML = "Surface du polygone : " + areaText;
        } else {
            document.getElementById("infoBubble").innerHTML = "";
        }
    }

    // Fonction pour mettre à jour les labels des distances sur les arêtes
    function updateDistanceLabels() {
        // Supprimer les anciennes labels
        distanceLabels.forEach(label => map.removeLayer(label));
        distanceLabels = [];

        if (polygon) {
            var latlngs = polygon.getLatLngs()[0];
            for (let i = 0; i < latlngs.length; i++) {
                let start = latlngs[i];
                let end = latlngs[(i + 1) % latlngs.length];

                let distance = calculateDistance(start, end);
                let middlePoint = L.latLng(
                    (start.lat + end.lat) / 2,
                    (start.lng + end.lng) / 2
                );

                let label = L.tooltip({
                    permanent: true,
                    direction: "center",
                    className: "distance-label"
                })
                    .setLatLng(middlePoint)
                    .setContent(distance + " m")
                    .addTo(map);

                distanceLabels.push(label);
            }
        }
    }

//* Buffer
    // Événement pour mettre à jour la pente ET recalculer le buffer
penteSlider.addEventListener('input', function() {
    pente = parseFloat(this.value);
    penteValue.textContent = pente;
    console.log("Nouvelle pente : " + pente + "%");

    updateBuffer(); // Mettre à jour le buffer en temps réel
});

// Fonction pour mettre à jour le buffer en temps réel
function updateBuffer() {
    if (!polygon || !bufferVisible) return;

    // Supprimer l'ancien buffer s'il existe
    if (bufferLayer) {
        map.removeLayer(bufferLayer);
    }

    // Récupération des coordonnées du polygone
    var coords = polygon.getLatLngs()[0].map(latlng => [latlng.lng, latlng.lat]);
    coords.push(coords[0]); // Fermer le polygone

    // Convertir en GeoJSON
    var polygonGeoJSON = turf.polygon([coords]);

    // Vérifier que la pente n'est pas 0 pour éviter une division par zéro
    var penteCorrigée = pente > 0 ? pente : 1; // Remplace 0 par 1 pour éviter NaN

    // Appliquer un buffer négatif avec correction
    var bufferSize = -profondeur / (penteCorrigée/100/2) / 1000 // Convertir mètres en kilomètres
    console.log("Calcul du bufferSize :", bufferSize, "km");

    var shrunkPolygon = turf.buffer(polygonGeoJSON, bufferSize, { units: 'kilometers' });

    // Vérifier si le buffer est valide
    if (!shrunkPolygon || shrunkPolygon.geometry.coordinates.length === 0) {
        console.warn("Le buffer est invalide ou trop petit.");
        return;
    }

    // Dessiner le nouveau buffer
    var newCoords = shrunkPolygon.geometry.coordinates[0].map(coord => [coord[1], coord[0]]);
    bufferLayer = L.polygon(newCoords, { color: "red", weight: 2, dashArray: "5, 5" }).addTo(map);
}


    // Fonction pour activer/désactiver l'affichage du buffer
    function toggleBuffer() {
        bufferVisible = !bufferVisible; // Inverser l'état du buffer

        if (!bufferVisible && bufferLayer) {
            map.removeLayer(bufferLayer);
            bufferLayer = null;
        } else {
            updateBuffer();
        }

        // Mettre à jour le texte du bouton
        document.getElementById("shrinkBtn").textContent = bufferVisible ? "Masquer le buffer" : "Afficher le buffer";
    }

    // Fonction pour mettre à jour les distances, l'air du polygone et le buffer
    function updatePolygonInfo() {
        updateDistanceLabels();
        updateBuffer();
        updatePolygonArea();
    }
//* Polygone interactif
    // Création du polygone interactif
    map.on('click', function() {
        if (!polygon) {
            polygon = map.editTools.startPolygon();
            polygon.enableEdit();

            polygon.on('editable:editing', updatePolygonInfo);
            polygon.on('editable:vertex:drag', updatePolygonInfo);
            polygon.on('editable:vertex:new', updatePolygonInfo);
            polygon.on('editable:vertex:deleted', updatePolygonInfo);
            polygon.on('editable:dragend', updatePolygonInfo);

            polygon.on('dblclick', function(e) {
                map.removeLayer(e.target);
                polygon = null;
                if (bufferLayer) {
                    map.removeLayer(bufferLayer);
                    bufferLayer = null;
                }
                distanceLabels.forEach(label => map.removeLayer(label));
                distanceLabels = [];
            });
        }
    });

//* Affichage du buffer
    // Ajouter un écouteur d'événement au bouton "shrinkBtn"
    var shrinkButton = document.getElementById("shrinkBtn");
    if (shrinkButton) {
        shrinkButton.addEventListener("click", toggleBuffer);
    } else {
        console.error("Bouton 'shrinkBtn' introuvable !");
    }

//* telechargement des coordonnées
    // Fonction pour télécharger les coordonnées du polygone
    document.getElementById('downloadBtn').addEventListener('click', function() {
        if (polygon) {
            var coords = polygon.getLatLngs()[0].map(latlng => [latlng.lng, latlng.lat]);
            coords.push(coords[0]);

            var coordsText = coords.map(coord => coord.join(', ')).join('\n');
            var blob = new Blob([coordsText], { type: 'text/plain' });
            var link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'coordonnees_polygone.txt';
            link.click();
        } else {
            alert("Veuillez d'abord dessiner un polygone sur la carte.");
        }
    });

 //* Sauvegarde et chargement des données
 saveButton.addEventListener("click", function () {
    var data = {
        profondeur: profondeur,
        pente: pente,
        polygonCoords: polygon ? polygon.getLatLngs()[0].map(latlng => [latlng.lat, latlng.lng]) : null
    };

    var blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "carte.json";
    link.click();
});

loadButton.addEventListener("click", function () {
    fileInput.click();
});

fileInput.addEventListener("change", function (event) {
    var file = event.target.files[0];
    var reader = new FileReader();
    reader.onload = function (e) {
        var data = JSON.parse(e.target.result);

        profondeur = data.profondeur || 10;
        pente = data.pente || 10;
        profondeurSlider.value = profondeur;
        penteSlider.value = pente;
        profondeurValue.textContent = profondeur;
        penteValue.textContent = pente;

        if (data.polygonCoords) {
            if (polygon) map.removeLayer(polygon);
            polygon = L.polygon(data.polygonCoords, { color: "blue" }).addTo(map);
            polygon.enableEdit();
        }
    };
    reader.readAsText(file);
});

});