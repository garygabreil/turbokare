// Generic GaragePro product — supports monthly, quarterly, and yearly licenses.
// Use in angular.json fileReplacements for non-TurboKare deployments.
export const environment = {
  production: true,
  product: {
    mode: 'garagepro' as const,
    displayName: 'GaragePro',
  },
  firebase: {
    apiKey: 'AIzaSyCnG_A97ZtKbKQWphltLEZaARdgysT5MM8',
    authDomain: 'garage-management-app-69195.firebaseapp.com',
    projectId: 'garage-management-app-69195',
    storageBucket: 'garage-management-app-69195.firebasestorage.app',
    messagingSenderId: '73821297496',
    appId: '1:73821297496:web:46fe0f490db9bb8117232d',
    measurementId: 'G-H95BEZEH0W',
  },
};
