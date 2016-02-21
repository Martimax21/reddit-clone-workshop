var React = require('react');
var ReactDOMServer = require('react-dom/server');
var Layout = require('./Layout');

function Signup(props) {
    return (
        <form action="/signup" method="post">
            {props.error && <span style={{color: "red"}}>{props.error}</span>}
            <div>
                <input type="text" name="username" placeholder="Username"/>
            </div>
            <div>
                <input type="password" name="password" placeholder="Password"/>
            </div>
            <button type="submit">Signup</button>
        </form>
    )
}

function renderToHtml(data) {
    var htmlStructure = (
        <Layout {...data.layout}>
            <Signup {...data.signup}/>
        </Layout>
    );
    
    return ReactDOMServer.renderToStaticMarkup(htmlStructure);
}

module.exports = {
    Signup: Signup,
    renderToHtml: renderToHtml
};