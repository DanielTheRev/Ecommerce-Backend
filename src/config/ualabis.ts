import UalaApiCheckout from 'ualabis-nodejs';

export async function initUalaCheckOut() {
	const credentials = {
		userName: process.env.ualaUserName || '',
		clientId: process.env.ualaClientId || '',
		clientSecret: process.env.ualaClientSecret || '',
		isDev: false
	};

	return await UalaApiCheckout.setUp(credentials);
}
