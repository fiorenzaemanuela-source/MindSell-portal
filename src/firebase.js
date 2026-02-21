import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBNllVcN4d8Juuji2U7-WJLKcqrteWDdVo",
  authDomain: "mindsell-portal.firebaseapp.com",
  projectId: "mindsell-portal",
  storageBucket: "mindsell-portal.firebasestorage.app",
  messagingSenderId: "663040680479",
  appId: "1:663040680479:web:93a9f49c5fe9bd1f806b2a"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
