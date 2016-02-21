var React = require('react');
var ReactDOMServer = require('react-dom/server');
var Layout = require('./Layout');

function CreateContent(props) {
    return (
        <form action="/createContent" method="post">
            {props.error && <span style={{color: "red"}}>{props.error}</span>}
            <div>
                <input type="text" name="url" placeholder="Link (e.g.: http://www.google.com)"/>
            </div>
            <div>
                <input type="text" name="title" placeholder="Title"/>
            </div>
            <button type="submit">Do it!</button>
        </form>
    )
}

function renderToHtml(data) {
    var htmlStructure = (
        <Layout {...data.layout}>
            <CreateContent {...data.createContent}/>
        </Layout>
    );
    
    return ReactDOMServer.renderToStaticMarkup(htmlStructure);
}

module.exports = {
    CreateContent: CreateContent,
    renderToHtml: renderToHtml
};