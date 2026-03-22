const axios = require('axios');

async function testUpdateProfile() {
    const url = 'http://localhost:3000/api/auth/update-profile';
    const payload = {
        uid: '7I7aV1NOcPVPEfXoy8KGk6D33pz1', // UID from user logs
        picture: '12.png',
        name: 'Roberto'
    };

    console.log('🧪 Probando actualización de perfil...');
    try {
        const response = await axios.post(url, payload);
        console.log('✅ Éxito:', response.data);
    } catch (error) {
        console.error('❌ Error 500 detectado:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Mensaje:', error.message);
        }
    }
}

testUpdateProfile();
