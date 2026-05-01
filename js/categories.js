(function () {
  "use strict";

  const global = window;
  global.ISD = global.ISD || {};

  const CATEGORIES = {
  "Profesionales y Proyectos": [
    "Arquitecto",
    "Calculista",
    "Ingeniero estructural",
    "Ingeniero eléctrico",
    "Ingeniero sanitario",
    "Topógrafo",
    "Mecánica de suelos",
    "Proyecto de agua",
    "Proyecto eléctrico",
    "Proyecto sanitario",
    "Proyecto de gas",
    "Estudios técnicos",
  ],

  "Permisos y Legal": [
    "Permiso municipal",
    "Recepción final",
    "Derechos municipales",
    "Notaría",
    "Conservador de bienes raíces",
    "Abogado",
    "Inscripción de propiedad",
    "Certificados legales",
  ],

  "Impuestos y Administración": [
    "IVA",
    "Contribuciones",
    "Contador",
    "Patente",
    "Gastos administrativos",
    "Comisiones bancarias",
    "Documentación tributaria",
  ],

  "Terreno y Obras Previas": [
    "Compra terreno",
    "Limpieza terreno",
    "Movimiento de tierra",
    "Cierre perimetral",
    "Nivelación",
    "Excavaciones",
    "Relleno",
    "Retiro de escombros",
  ],

  "Construcción Obra Gruesa": [
    "Materiales obra gruesa",
    "Hormigón",
    "Cemento",
    "Áridos",
    "Fierro",
    "Acero",
    "Madera estructural",
    "Radier",
    "Fundaciones",
    "Muros",
    "Pilares",
    "Vigas",
    "Techumbre",
  ],

  "Construcción Terminaciones": [
    "Aislación",
    "Ventanas",
    "Puertas",
    "Pintura",
    "Revestimientos",
    "Pisos",
    "Cerámicas",
    "Quincallería",
    "Muebles",
    "Artefactos",
    "Terminaciones generales",
  ],

  Instalaciones: [
    "Electricidad",
    "Gasfitería",
    "Agua potable",
    "Alcantarillado",
    "Gas",
    "Calefacción",
    "Climatización",
    "Internet / comunicaciones",
    "Iluminación",
    "Tableros eléctricos",
  ],

  "Mano de Obra": [
    "Maestro constructor",
    "Jornales",
    "Carpintería",
    "Soldadura",
    "Electricista",
    "Gasfíter",
    "Pintor",
    "Especialistas",
    "Ayudantes",
  ],

  "Herramientas y Maquinaria": [
    "Compra de herramientas",
    "Arriendo de herramientas",
    "Arriendo maquinaria",
    "Mantención maquinaria",
    "Equipos menores",
    "Elementos de seguridad",
  ],

  "Logística y Transporte": [
    "Transporte",
    "Fletes",
    "Combustible",
    "Envíos",
    "Carga y descarga",
    "Bodega",
    "Almacenamiento",
    "Traslado de materiales",
  ],

  "Servicios Básicos": ["Agua", "Luz", "Gas", "Internet", "Medidores", "Empalmes", "Conexiones"],

  "Reembolsos y Ajustes": [
    "Reembolso Gabriel",
    "Reembolso Vania",
    "Ajuste contable",
    "Corrección de movimiento",
    "Devolución proveedor",
  ],

  "Aportes / Capital": [
    "Depósito Gabriel",
    "Depósito Vania",
    "Inyección de capital",
    "Aporte 50/50",
    "Préstamo socio",
    "Otro ingreso",
  ],

  Otros: ["Emergencias", "Correcciones", "Gastos no clasificados", "Imprevistos", "Varios"],
  };

  function getCategoryGroups() {
    return Object.keys(CATEGORIES);
  }

  function getSubcategoriesForGroup(categoryGroup) {
    const subs = CATEGORIES[categoryGroup];
    return Array.isArray(subs) ? subs : [];
  }

  global.ISD.categories = {
    CATEGORIES,
    getCategoryGroups,
    getSubcategoriesForGroup,
  };
})();

