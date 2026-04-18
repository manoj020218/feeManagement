// src/core/services/driveBackupService.ts
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { Filesystem, Directory } from '@capacitor/filesystem';

// Initialize the plugin (do this once, when your app starts)
GoogleAuth.initialize();

export const performDriveBackup = async (backupData: object, fileName: string) => {
  try {
    // 1. Sign in the user to get an access token
    const googleUser = await GoogleAuth.signIn();
    const accessToken = googleUser.authentication?.accessToken;

    if (!accessToken) {
      throw new Error('Could not get access token');
    }

    // 2. Prepare the backup file
    const fileContent = JSON.stringify(backupData, null, 2);
    const filePath = `backup_${Date.now()}.json`;
    
    // Write the file temporarily to the device's cache directory
    await Filesystem.writeFile({
      path: filePath,
      data: fileContent,
      directory: Directory.Cache,
    });

    // 3. Read the file as a Blob to upload
    const fileInfo = await Filesystem.readFile({
      path: filePath,
      directory: Directory.Cache,
    });

    const blob = new Blob([fileInfo.data], { type: 'application/json' });
    const metadata = {
      name: fileName,
      mimeType: 'application/json',
      parents: ['root'], // 'root' is the user's Drive root folder
    };

    // 4. Upload to Google Drive API
    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', blob);

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Upload failed: ${JSON.stringify(errorData)}`);
    }

    // 5. Clean up: delete the temporary file from the device
    await Filesystem.deleteFile({
      path: filePath,
      directory: Directory.Cache,
    });

    console.log('Backup successful!');
    return true;
  } catch (error) {
    console.error('Backup failed:', error);
    throw error; // Re-throw so your UI can show an error message
  }
};