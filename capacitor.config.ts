import type { CapacitorConfig } from '@capacitor/cli';

// iOS / iPadOS: ο ίδιος κώδικας με το web app (React/Vite), πακεταρισμένος μέσα στην εφαρμογή — δουλεύει χωρίς σύνδεση.
// ΠΡΟΣΩΡΙΝΑ: appId και appName είναι ονόματα εργασίας· ορίζονται οριστικά πριν από το πρώτο build για συσκευή.
const config: CapacitorConfig = {
  appId: 'gr.yiami.manuals',
  appName: 'Εγχειρίδια',
  webDir: 'dist',
  // χωρίς καταγραφή των μηνυμάτων JS↔native: αλλιώς η κονσόλα της συσκευής θα έδειχνε περιεχόμενο αρχείων (base64)
  loggingBehavior: 'none',
  ios: {
    backgroundColor: '#F5F3EE',
    contentInset: 'never', // safe area μέσω CSS env()
  },
};

export default config;
