import {Editor, EditorState, RichUtils, Modifier, EditorBlock, convertToRaw, convertFromRaw} from 'draft-js';
import { useState, useEffect } from 'react';
import 'draft-js/dist/Draft.css';
import "./TextEditor.css"

function MyEditor() {
  const [editorState, setEditorState] = useState(
    () => EditorState.createEmpty(),
  );

  const [popup, setPopup] = useState({ show: false, message: '' });
  const [currentStyles, setCurrentStyles] = useState('');
  
  
  const styleMap = {
    'RED_TEXT': {
      color: 'red',
    },
  };   

  const shortcuts = [
    { key: '*', description: 'Bold the text after typing * and space.' },
    { key: '#', description: 'Change the line to Heading 1 after typing # and space.' },
    { key: '**', description: 'Turn text red after typing ** and space.' },
    { key: '***', description: 'Underline text after typing *** and space.' },
    { key: '```', description: 'Create a code block after typing ``` and space.' },
    { key: '``', description: 'Remove a code block after typing `` and space within a code block.' },
  ];

  useEffect(() => {
    const savedContent = localStorage.getItem('editorContent');
    if (savedContent) {
      const content = convertFromRaw(JSON.parse(savedContent));
      setEditorState(EditorState.createWithContent(content));
    }
  }, []);

  const CodeBlock = (props) => {
    return (
      <pre style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
        <EditorBlock {...props} />
      </pre>
    );
  };

  const saveContent = () => {
    const contentState = editorState.getCurrentContent();
    const raw = convertToRaw(contentState);
    localStorage.setItem('editorContent', JSON.stringify(raw));
    showPopup("Content Saved");
  };
  function blockRendererFn(contentBlock) {
    const type = contentBlock.getType();
    if (type === 'code-block') {
      return {
        component: CodeBlock,
        props: {
          content: contentBlock.getText(), // Pass the block's text as a prop
        },
      };
    }
  }

  const getCurrentStyles = (editorState) => {
    const currentStyle = editorState.getCurrentInlineStyle();
    const selection = editorState.getSelection();
    const blockType = editorState
      .getCurrentContent()
      .getBlockForKey(selection.getStartKey())
      .getType();
  
    // Collecting all active styles
    let styles = [];
    currentStyle.forEach((style) => styles.push(style));
    
    // Adding block type if it's not the default 'unstyled'
    if (blockType !== 'unstyled') {
      styles.push(blockType.toUpperCase()); // Example: 'code-block' becomes 'CODE-BLOCK'
    }
  
    return styles.join(', '); // Example output: "BOLD, ITALIC, CODE-BLOCK"
  };
  
  const onChange = (newEditorState) => {
    setEditorState(newEditorState);
    // Update the current styles whenever the editor state changes
    const styles = getCurrentStyles(newEditorState);
    setCurrentStyles(styles);
  };
  const handleBeforeInput = (chars, editorState) => {
    const currentContent = editorState.getCurrentContent();
    const currentSelection = editorState.getSelection();
    const startKey = currentSelection.getStartKey();
    const currentBlock = currentContent.getBlockForKey(startKey);
    const blockText = currentBlock.getText();
    const endOffset = currentSelection.getEndOffset();
    const blockType = currentBlock.getType();
    const selection = editorState.getSelection();
    

    if (!selection.isCollapsed()) return 'not-handled';

    

    function applyStyleAndRemovePattern(editorState, selection, endOffset, pattern, style) {
      const currentContent = editorState.getCurrentContent();
      const newContentState = Modifier.replaceText(
        currentContent,
        selection.merge({
          anchorOffset: endOffset - pattern.length,
          focusOffset: endOffset,
        }),
        '', // Remove the pattern
      );
  
      let newEditorState = EditorState.push(editorState, newContentState, 'replace-text');
      newEditorState = RichUtils.toggleInlineStyle(newEditorState, style);
      setEditorState(newEditorState);
      return 'handled';
    }


    // Check if # is typed at the beginning and space is pressed
    if (chars === ' ' && blockText === '*') {
      const newContentState = Modifier.replaceText(
        currentContent,
        currentSelection.merge({ anchorOffset: 0, focusOffset: endOffset }),
        '', 
      );
      const newEditorState = EditorState.push(editorState, newContentState, 'replace-text');

      const withBold = RichUtils.toggleInlineStyle(newEditorState, 'BOLD');
      
      showPopup("Bold");
      
      setEditorState(withBold);
      return 'handled';
    }

    if (chars === ' ' && blockText === '#') {
      const newContentState = Modifier.replaceText(
        currentContent,
        currentSelection.merge({ anchorOffset: 0, focusOffset: endOffset }),
        '',
      );
      const newEditorState = EditorState.push(editorState, newContentState, 'replace-text');
  
      // Change the block type to 'header-one'
      const withHeader = RichUtils.toggleBlockType(newEditorState, 'header-one');
  
      showPopup("Heading-1");

      setEditorState(withHeader);
      return 'handled';
    }

    if (chars === ' ' && blockText.endsWith('***')) {
      // Remove '***' pattern and apply UNDERLINE style
      showPopup("underline");
      return applyStyleAndRemovePattern(editorState, selection, endOffset, '***', 'UNDERLINE');
    }
    // Check if the pattern '**' is followed by space for red text
    else if (chars === ' ' && blockText.endsWith('**')) {
      // Custom style for RED_TEXT needs to be defined in the styleMap
      showPopup("Red Text");
      return applyStyleAndRemovePattern(editorState, selection, endOffset, '**', 'RED_TEXT');
    }

    if (chars === ' ' && blockText.endsWith('```')) {
      const blockKey = selection.getStartKey();
      const blockMap = currentContent.getBlockMap();
      const block = currentContent.getBlockForKey(blockKey);
      const blocksBefore = blockMap.toSeq().takeUntil((v) => v === block);
      const blocksAfter = blockMap.toSeq().skipUntil((v) => v === block).rest();
      const newBlock = block.merge({
        type: 'code-block',
        text: '', // Optionally remove the '```' or leave it based on your needs
      });
  
      const newContent = currentContent.merge({
        blockMap: blocksBefore.concat([[blockKey, newBlock]], blocksAfter).toOrderedMap(),
      });
  
      const newEditorState = EditorState.push(editorState, newContent, 'change-block-type');
      showPopup("code-block");
      setEditorState(newEditorState);
      return 'handled';
    }

    if (chars === ' ' && blockText.endsWith('``') && blockType === 'code-block') {
      // Remove the trailing `` and change block type to 'unstyled'
      const newBlockText = blockText.slice(0, -2); // Remove the last two characters (``)
      const newContentState = Modifier.replaceText(
        currentContent,
        selection.merge({
          anchorOffset: 0,
          focusOffset: endOffset,
        }),
        newBlockText
      );
  
      let newEditorState = EditorState.push(editorState, newContentState, 'replace-text');
      newEditorState = RichUtils.toggleBlockType(newEditorState, 'unstyled');
  
      setEditorState(newEditorState);
      return 'handled';
    }
    
    return 'not-handled';
  };


  const showPopup = (message) => {
    setPopup({ show: true, message: message });

    setTimeout(() => {
      setPopup({ show: false, message: '' });
    }, 1000);
  };

  return  (
    <>
     {popup.show && <Popup message={popup.message} />}
      <div>
        <h4 style={{textAlign: 'center', color: "#646e7f"}}>Demo editor by Akshay Kulkarni</h4>
        <div className='saveBtn-container'>
            <button className='save-button' onClick={saveContent}>Save</button>
        </div>
      </div>
      
      <div className="RichEditor-root">
      <Editor className = "RichEditor-editor" editorState={editorState} onChange={onChange} 
      customStyleMap={styleMap}
      handleBeforeInput={handleBeforeInput}
      blockRendererFn={blockRendererFn} />
      </div>
      <div className="active-styles" style={{ marginLeft: "10%"}}>
          <strong>Active Styles:</strong> {currentStyles || 'None'}
      </div>
      <div className="shortcut-guidelines" style={{ marginLeft: "10%"}}>
        <h5 style={{marginBottom: 0}}>Shortcut Keys:</h5>
        <ul style={{marginTop: 0}}>
          {shortcuts.map((shortcut, index) => (
            <li style={{fontSize: "0.7rem"}} key={index}><strong>{shortcut.key}</strong>: {shortcut.description}</li>
          ))}
        </ul>
      </div>
      </>
    )
    }

export default MyEditor;


function Popup({ message }) {
    return (
      <div style={{
        position: 'fixed',
        top: '20%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: '#FFF',
        padding: '10px',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
        zIndex: 1000,
        display: message ? 'block' : 'none',
      }}>
        {message}
      </div>
    );
  }
  