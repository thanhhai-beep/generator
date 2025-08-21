
import admin from 'firebase-admin';
import type { App } from 'firebase-admin/app';
import type { Auth, UserRecord } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';

// --- SINGLETON INITIALIZATION ---

type FirebaseAdminServices = {
    app: App;
    auth: Auth;
    firestore: Firestore;
};

let services: FirebaseAdminServices | undefined;

const isConfigured = !!process.env.FIREBASE_PROJECT_ID && !!process.env.FIREBASE_CLIENT_EMAIL && !!process.env.FIREBASE_PRIVATE_KEY;

/**
 * Initializes and returns the Firebase Admin SDK services, ensuring it only happens once.
 * This is a robust singleton pattern for serverless environments.
 */
function createFirebaseAdmin(): FirebaseAdminServices {
    if (!isConfigured) {
        throw new Error('Firebase Admin SDK is not configured. Please set environment variables.');
    }

    if (admin.apps.length > 0 && admin.apps[0]) {
        const app = admin.apps[0]!;
        const auth = admin.auth(app);
        const firestore = admin.firestore(app);
        try {
            // This might still be called multiple times in dev with hot-reloading
            // The catch block will handle the error gracefully.
            firestore.settings({ ignoreUndefinedProperties: true });
        } catch (e: any) {
            if (!e.message.includes('Firestore has already been started')) {
                 console.error("Could not set Firestore settings:", e);
            }
        }
        return { app, auth, firestore };
    }

    const app = admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
    });

    const auth = admin.auth(app);
    const firestore = admin.firestore(app);
    firestore.settings({ ignoreUndefinedProperties: true }); // Ensure settings are applied

    return { app, auth, firestore };
}

/**
 * Gets the initialized Firebase Admin services.
 * This function ensures that the services are created only once.
 */
export function getFirebaseAdmin(): FirebaseAdminServices {
    if (!services) {
        services = createFirebaseAdmin();
    }
    return services;
}

// --- END INITIALIZATION ---


export async function listAllUsersAdmin(): Promise<{ success: boolean, users?: (UserRecord & { permissions?: string[] })[], message: string }> {
    if (!isConfigured) {
        return { success: false, message: 'Firebase Admin SDK is not configured.' };
    }
    try {
        const { auth, firestore } = getFirebaseAdmin();

        const authUsersResponse = await auth.listUsers(1000);
        const authUsers = authUsersResponse.users;
        
        const permissionsMap = new Map<string, string[]>();

        try {
            const usersCollectionRef = firestore.collection('users');
            const permissionsSnapshot = await usersCollectionRef.get();
            permissionsSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.permissions) {
                    permissionsMap.set(doc.id, data.permissions);
                }
            });
        } catch (error: any) {
            if (error.code === 5 || (error.details && error.details.includes('NOT_FOUND'))) {
                console.warn("The 'users' collection was not found. This is expected on first run.");
            } else {
                 console.error("Firestore error while fetching permissions:", error);
                 return { success: false, message: `An unexpected Firestore error occurred: ${error.message}` };
            }
        }

        const usersWithPermissions = authUsers.map(user => {
            const permissions = permissionsMap.get(user.uid) || [];
            return {
                ...user.toJSON() as UserRecord,
                permissions,
            };
        });

        return { success: true, users: usersWithPermissions, message: "Users listed successfully." };
    } catch (error: any) {
        console.error("Error listing Firebase users:", error);
        return { success: false, message: error.message || "An unknown error occurred while listing users." };
    }
}

export async function deleteUserAdmin(uid: string): Promise<{ success: boolean, message: string }> {
     if (!isConfigured) {
        return { success: false, message: 'Firebase Admin SDK is not configured.' };
    }
    try {
        const { auth, firestore } = getFirebaseAdmin();
        await auth.deleteUser(uid);
        await firestore.collection('users').doc(uid).delete().catch(e => console.warn(`Could not delete user from Firestore (uid: ${uid}), it might not have existed.`));
        
        return { success: true, message: "User deleted successfully." };
    } catch (error: any) {
        console.error(`Error deleting Firebase user ${uid}:`, error);
        return { success: false, message: error.message || "An unknown error occurred." };
    }
}


export async function updateUserPermissionsAdmin(uid: string, permissions: string[], email?: string | null): Promise<{ success: boolean; message: string }> {
     if (!isConfigured) {
        return { success: false, message: 'Firebase Admin SDK is not configured.' };
    }
    try {
        const { firestore } = getFirebaseAdmin();
        const userDocRef = firestore.collection('users').doc(uid);
        
        const userData: { [key: string]: any } = {
            permissions: permissions,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (email) {
            userData.email = email;
        }
        
        await userDocRef.set(userData, { merge: true });
        
        return { success: true, message: "User permissions updated successfully." };
    } catch (error: any) {
        console.error(`Error updating permissions for user ${uid}:`, error);
        let message = error.message || "An unknown error occurred.";
        
        return { success: false, message };
    }
}


export async function getUserPermissionsAdmin(uid: string): Promise<{ success: boolean, permissions?: string[], message: string }> {
     if (!isConfigured) {
        return { success: false, message: 'Firebase Admin SDK is not configured.' };
    }
    try {
        const { firestore } = getFirebaseAdmin();
        const userDocRef = firestore.collection('users').doc(uid);
        const doc = await userDocRef.get();

        if (!doc.exists) {
            return { success: true, permissions: [], message: "User has no specific permissions set." };
        }

        const data = doc.data();
        const permissions = data?.permissions || [];
        return { success: true, permissions, message: "Permissions fetched successfully." };

    } catch (error: any) {
        console.error(`Error fetching permissions for user ${uid}:`, error);
        return { success: false, message: error.message || "An unknown error occurred." };
    }
}
