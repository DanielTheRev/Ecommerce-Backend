const apiKey = 're_TEahVdak_86MToncPyuNPN7G4U57vH992';

import { Resend } from 'resend';

const resend = new Resend(apiKey);

const sendEmail = async () => {
	const { data, error } = await resend.emails.send({
		from: 'LarrosaDaniel@technologia.store>',
		to: ['fernando.larrosa94@gmail.com'],
		subject: 'Se supone que con esto puedo enviar emails. A ver si me lo funcionan.',
		html: '<p>Se supone que con esto puedo enviar emails. A ver si me lo funcionan.</p>'
	});

	if (error) {
		return console.error({ error });
	}

	console.log({ data });
};

// Ejecutar solo si se llama directamente
if (require.main === module) {
	sendEmail();
}

export { sendEmail };
