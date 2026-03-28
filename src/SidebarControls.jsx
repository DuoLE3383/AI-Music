import "./SidebarControls.css";

const SidebarControls = ({ onGenerate, onUpload, loading }) => {
  return (
    <div className="sidebar">
      <button onClick={onGenerate} disabled={loading}>
        Generate
      </button>

      <button onClick={onUpload} disabled={loading}>
        Remix
      </button>
    </div>
  );
};

export default SidebarControls;
