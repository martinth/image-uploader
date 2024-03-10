
const SECRET_PUT_KEY = "479F111E64F34B7ABC39B6B7710F3585";
const LATEST_IMAGE_KEY = "latest.jpg";
const MAX_CURRENT_AGE = 10 * 60 * 1000; /* in ms */
const NO_LIVE_IMAGE_KEY = "no_live_image.jpg"

export default {
	async fetch(request, env) {
		// If this request is coming from image resizing worker,
		// avoid causing an infinite loop by resizing it again:
		if (/image-resizing/.test(request.headers.get("via"))) {
			return fetch(request)
		}

        const params = {};
        const url = new URL(request.url);
        const now = new Date();

		if (url.pathname === '/upload/latest.jpg' && request.method === 'PUT') {
			let auth = request.headers.get("authorization");
			if (!auth) {
			  return new Response("Unauthorized", {status: 401 });
			}

			if (!!auth && auth === "Bearer " + SECRET_PUT_KEY) {
              const archive_key = "archive/" + now.toISOString();
			  const tee = request.body.tee();
			  await env.snapshot_bucket.put(LATEST_IMAGE_KEY, tee[0]);
			  await env.snapshot_bucket.put(archive_key, tee[1]);
              console.log("Stored current and " + archive_key)
			  return new Response("Stored");
			} else {
			  return new Response("Forbidden", {status: 403 });
			}
		}

		if (request.method === 'GET') {
			// fallback for current image code
			if (url.pathname === '/current.jpg' || url.pathname === '/full/latest.jpg') {
				let object = await env.snapshot_bucket.get(LATEST_IMAGE_KEY);

                if (object === null) {
                  return new Response('Object Not Found', { status: 404 });
                }

                const headers = new Headers();
                headers.set('Access-Control-Allow-Origin', '*');

                // if current image is too old, replace with placeholder
                let age = now.getTime() - object.uploaded.getTime();
                if (age > MAX_CURRENT_AGE) {
                  const placeholder = await env.snapshot_bucket.get(NO_LIVE_IMAGE_KEY);
                  if (placeholder !== null) {
                    object = placeholder;
                  } else {
                    console.error("Current image is too old but no placeholder image found");
                  }
                }

                headers.set('etag', object.etag);
                const requestEtag = request.headers.get('if-none-match')
                if (requestEtag) {
                  if (object.etag === requestEtag) {
                    return new Response(null, { status: 304, headers });
                  }
                }

                object.writeHttpMetadata(headers);
                return new Response(object.body, {
                  headers,
                });
			}

		}

		return new Response("Not found", {
			status: 404,
		});

	},
};