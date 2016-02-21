var React = require('react');
var ReactDOMServer = require('react-dom/server');
var Layout = require('./Layout');

function HomePage(props) {
    
    var contentList = props.contents.map(
        function(contentItem) {
            return (
                <li key={contentItem.id}>
                    <Post {...contentItem}/>
                </li>
            );
        }
    );
    
    return (
        <div>
            <ul>
                {contentList.length ? contentList : 'no content available'}
            </ul>
        </div>
    );
}

function Post(props) {
    return (
        <div>
            <h2>
                <span>{props.voteScore}</span>
                <a href={props.url}>
                    {props.title}
                </a>
            </h2>
            <cite>Posted by {props.postedBy}</cite>
            <form action="/vote" method="post">
              <input type="hidden" name="contentId" value={props.id}/>
              <input type="hidden" name="voteDirection" value="1"/>
              <button type="submit">up vote</button>
            </form>
            <form action="/vote" method="post">
              <input type="hidden" name="contentId" value={props.id}/>
              <input type="hidden" name="voteDirection" value="-1"/>
              <button type="submit">down vote</button>
            </form>
        </div>
    );
}

function renderToHtml(data) {
    var htmlStructure = (
        <Layout {...data.layout}>
            <HomePage {...data.homepage}/>
        </Layout>
    );
    
    return ReactDOMServer.renderToStaticMarkup(htmlStructure);
}

module.exports = {
    HomePage: HomePage,
    renderToHtml: renderToHtml
};