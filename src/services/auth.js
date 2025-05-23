import { auth, db } from '../firebase/config'
import { ref as dbRef, update } from 'firebase/database'
import { onAuthStateChanged } from 'firebase/auth'

// Update user verification status on login
export function setupVerificationStatusUpdater() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // User is signed in, update their verification status in the database
      const userRef = dbRef(db, `users/${user.uid}`)
      await update(userRef, {
        emailVerified: user.emailVerified,
        lastLogin: Date.now()
      })
    }
  })
}
