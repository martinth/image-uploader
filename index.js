
const SECRET_PUT_KEY = "479F111E64F34B7ABC39B6B7710F3585";
const LATEST_IMAGE_KEY = "latest.jpg";

export default {
	async fetch(request, env) {
		// If this request is coming from image resizing worker,
		// avoid causing an infinite loop by resizing it again:
		if (/image-resizing/.test(request.headers.get("via"))) {
			return fetch(request)
		}


        const params = {}
        const url = new URL(request.url)

		if (url.pathname === '/upload/latest.jpg' && request.method === 'PUT') {
			let auth = request.headers.get("authorization");
			if (!auth) {
			  return new Response("Unauthorized", {status: 401 });
			}

			if (!!auth && auth === "Bearer " + SECRET_PUT_KEY) {
			  await env.snapshot_bucket.put(LATEST_IMAGE_KEY, request.body);
			  // TODO: store archived images

			  return new Response("Stored");
			} else {
			  return new Response("Forbidden", {status: 403 });
			}
		}

		if (request.method === 'GET') {
			// fallback for current image code
			console.log(url.pathname);
			if (url.pathname === '/current.jpg' || url.pathname === '/full/latest.jpg') {
				const object = await env.snapshot_bucket.get(LATEST_IMAGE_KEY);

                if (object === null) {
                  return new Response('Object Not Found', { status: 404 });
                }

                const headers = new Headers();
                object.writeHttpMetadata(headers);
                headers.set('etag', object.httpEtag);

                return new Response(object.body, {
                  headers,
                });
			}

			// TODO: add image compression
		}

		return new Response("Not found", {
			status: 404,
		});

	},
};