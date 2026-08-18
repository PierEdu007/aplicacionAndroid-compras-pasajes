# 📱 Tunky Chasky Admin — Aplicación Android Oficial

Aplicación móvil nativa Android para la administración, control de salidas, venta de pasajes en mostrador de agencia, emisión de comprobantes electrónicos SUNAT (NubeFact) y reportes contables de **Inversiones Tunky Chasky S.R.L.**.

---

## 🚀 Características Principales

1. ⚡ **Sincronización en Tiempo Real**: Conectado a la misma base de datos Supabase que la página web. Si un cliente compra en la web, la app suena y se actualiza al instante.
2. 🛒 **Venta Presencial en Agencia**: Formulario rápido para vender pasajes en mostrador con consulta automática de DNI (RENIEC) y RUC (SUNAT).
3. 🧾 **Emisión SUNAT / NubeFact**: Emisión automática de Boletas (`BBB1`) y Facturas (`FFF1`) oficiales con 1 toque.
4. 🖨️ **Boleto de Viaje Compartible e Imprimible**: Generación de ticket en formato térmico 80mm para imprimir vía Bluetooth o enviar por WhatsApp al pasajero.
5. 🚐 **Mapa de Asientos Interactivo**: Visualización gráfica del estado de los asientos en camionetas de 4 y 6 pasajeros.
6. 📊 **Liquidación Contable Mensual**: Cálculo automático de ventas exoneradas e Impuesto a la Renta MIPE (1.0%).

---

## 🛠️ Tecnologías Utilizadas

- **Framework**: React Native + Expo SDK 52 (TypeScript)
- **Base de Datos & Auth**: Supabase (PostgreSQL + Realtime)
- **Facturación Electrónica**: NubeFact PSE API
- **Correos Transaccionales**: Resend API
- **Consultas RENIEC / SUNAT**: APIs Perú
- **Impresión / PDF**: Expo Print & Expo Sharing

---

## 📲 Cómo Probar en Desarrollo

1. Instala las dependencias:
   ```bash
   npm install
   ```

2. Inicia el servidor de desarrollo Expo:
   ```bash
   npx expo start
   ```

3. Abre la app **Expo Go** en cualquier teléfono Android y escanea el código QR que aparecerá en tu terminal.

---

## 📦 Cómo Generar el Archivo Instalador APK Directo

Para generar el archivo `.apk` instalable directamente en los celulares de los trabajadores:

1. Inicia sesión en Expo EAS:
   ```bash
   npx eas-cli login
   ```

2. Configura el build de APK:
   ```bash
   npx eas-cli build -p android --profile preview
   ```

3. Descarga el archivo `.apk` generado y compártelo a tus trabajadores por WhatsApp.
