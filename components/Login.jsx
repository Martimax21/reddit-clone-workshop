var React = require('react');
var ReactDOMServer = require('react-dom/server');
var Layout = require('./Layout');

function Login(props) {
    return (
        <form action="/login" method="post">
            {props.message && <span style={{color: "green"}}>{props.message}</span>}
            {props.error && <span style={{color: "red"}}>{props.error}</span>}
            <div>
                <input type="text" name="username" placeholder="Username"/>
            </div>
            <div>
                <input type="password" name="password" placeholder="Password"/>
            </div>
            <button type="submit">Login</button>
        </form>
    )
}

function renderToHtml(data) {
    var htmlStructure = (
        <Layout {...data.layout}>
            <Login {...data.login}/>
        </Layout>
    );
    
    return ReactDOMServer.renderToStaticMarkup(htmlStructure);
}

module.exports = {
    Login: Login,
    renderToHtml: renderToHtml
};