import UalaApiCheckout from 'ualabis-nodejs';

export async function initUalaCheckOut() {
	return await UalaApiCheckout.setUp({
		// userName: 'fertherev',
		// clientId: 'lUkMcJWsb3RznEIRexHXvluzKsRTtkaj',
		// clientSecret: 'boNU0ns_xhyufc96HW0Q1K0Re389ylTha454ouMhaFeIKUrJ56BUiGb0LMMRlRdF',
		// isDev: true

		userName: 'new_user_1631906477',
		clientId: '5qqGKGm4EaawnAH0J6xluc6AWdQBvLW3',
		clientSecret: 'cVp1iGEB-DE6KtL4Hi7tocdopP2pZxzaEVciACApWH92e8_Hloe8CD5ilM63NppG',
		isDev: true
	});
}
