# Ezzeta Sistema Tracking

Sistema de seguimiento de pedidos desarrollado con Angular 21 y Laravel 12.

## 🚀 Características

- **Dashboard de pedidos** con métricas en tiempo real
- **Seguimiento visual** del estado de los pedidos
- **Gestión de usuarios** con roles (Admin, Vendedor Web, Vendedor Redes)
- **API REST** con autenticación JWT
- **Interfaz responsive** con Bootstrap 5
- **Gráficos interactivos** con ApexCharts

## 🛠️ Tecnologías

- **Frontend**: Angular 21, TypeScript, Bootstrap 5
- **Backend**: Laravel 12, PostgreSQL, JWT
- **Charts**: ApexCharts
- **Icons**: Ant Design Icons

## 📦 Instalación

1. **Clonar el repositorio**
```bash
git clone <url-del-repositorio>
cd frontend-tracking
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
```bash
# Copiar archivo de configuración
cp src/environments/environment.ts.example src/environments/environment.ts

# Editar con la URL de tu API
```

4. **Ejecutar en desarrollo**
```bash
npm start
```

## 🔧 Configuración

### Variables de entorno
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8000/api/v1'
};
```

### Backend requerido
Asegúrate de tener corriendo el backend Laravel en `http://localhost:8000`

## 📱 Funcionalidades

- ✅ Autenticación JWT
- ✅ Dashboard con métricas
- ✅ Lista paginada de pedidos
- ✅ Modal detallado de pedidos
- ✅ Seguimiento visual de estados
- ✅ Cambio de estado interactivo
- ✅ Filtros por fuente (Web/Redes)
- ✅ Responsive design

## 🏗️ Arquitectura

```
frontend-tracking/
├── src/
│   ├── app/
│   │   ├── services/          # Servicios API
│   │   ├── models/           # Interfaces TypeScript
│   │   ├── demo/
│   │   │   ├── dashboard/    # Dashboard principal
│   │   │   ├── pages/        # Páginas de pedidos
│   │   │   └── theme/        # Tema y componentes
│   └── environments/         # Configuración
```

## 📄 Licencia

MIT License - ver archivo LICENSE para más detalles.

## 🤝 Contribuir

1. Fork el proyecto
2. Crea tu rama de feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📞 Soporte

Para soporte técnico contactar al equipo de desarrollo.
