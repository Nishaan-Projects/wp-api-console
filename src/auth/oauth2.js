import superagent from 'superagent';
import qs from 'qs';

const createAuthProvider = ( name, baseUrl, userUrl, redirectUrl, clientId, scope = null ) => {
	const TOKEN_STORAGE_KEY = `${ name }__OAUTH2ACCESSTOKEN`;
	const REQUEST_TOKEN_STORAGE_KEY = `${ name }__REQUESTOAUTH2ACCESSTOKEN`;

	let accessToken = null;
	const init = () => {
		// Extract any token from url or localstorage
		accessToken = localStorage.getItem( TOKEN_STORAGE_KEY );
		if ( accessToken ) {
			return;
		}
		const url = window.location.toString();
		const index = url.indexOf( '#access_token' );
		if ( index === -1 ) {
			return;
		}
		const hash = url.slice( index + 1 );
		const queryParams = qs.parse( hash );
		const token = queryParams.access_token;

		// This ensures we're requesting the current access token (not another oauth2 provider)
		if ( localStorage.getItem( REQUEST_TOKEN_STORAGE_KEY ) ) {
			localStorage.removeItem( REQUEST_TOKEN_STORAGE_KEY );
			localStorage.setItem( TOKEN_STORAGE_KEY, token );
			window.location = window.location.pathname;
		}
	};

	const boot = () => {
		if ( ! accessToken ) {
			return Promise.reject();
		}

		return superagent
			.get( userUrl )
			.set( 'accept', 'application/json' )
			.set( 'Authorization', `BEARER ${ accessToken }` )
			.then( res => {
				if ( res.body && res.body.avatar_URL ) {
					res.body.avatarUrl = res.body.avatar_URL;
					delete res.body.avatar_URL;
				}
				return res.body;
			}, err => {
				accessToken = null;
				localStorage.removeItem( TOKEN_STORAGE_KEY );
				return Promise.reject();
			} );
	};

	const logout = () => {
		localStorage.removeItem( TOKEN_STORAGE_KEY );
		accessToken = false;
	};

	const login = () => {
		localStorage.setItem( REQUEST_TOKEN_STORAGE_KEY, '1' );
		window.location = `${ baseUrl }/authorize?` +
			`client_id=${ encodeURIComponent( clientId ) }&response_type=token` +
			( scope ? `&scope=${ scope }` : '' ) +
			`&redirect_uri=${ redirectUrl }`;
	};

	const request = ( { method, url, body } ) => {
		const req = superagent( method, url )
			.set( 'accept', 'application/json' );

		if ( body && Object.keys( body ).length > 0 ) {
			req.send( body );
		}

		if ( accessToken ) {
			req.set( 'Authorization', `BEARER ${ accessToken }` );
		}

		return new Promise( resolve =>
			req.end( ( err, response = {} ) => {
				resolve( {
					status: response.status,
					body: response.body,
					error: err,
				} );
			} )
		);
	};

	// initialize
	init();

	return {
		boot, login, logout, request,
	};
};

export default createAuthProvider;
